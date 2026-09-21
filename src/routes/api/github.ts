import { createFileRoute } from "@tanstack/react-router";

type FilePayload = { path: string; content: string };
type Body = { repo?: string; description?: string; private?: boolean; files?: FilePayload[] };

const GATEWAY = "https://connector-gateway.lovable.dev/github";

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "forge-site"
  );
}

export const Route = createFileRoute("/api/github")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["GITHUB_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return Response.json({ error: "GitHub is not connected yet." }, { status: 500 });
        }

        const body = (await request.json()) as Body;
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length === 0) {
          return Response.json({ error: "There are no files to push." }, { status: 400 });
        }
        const repo = slug(body.repo ?? "forge-site");

        const call = async (path: string, init?: RequestInit) => {
          const response = await fetch(`${GATEWAY}/${path}`, {
            ...init,
            headers: {
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": connectionKey,
              ...(init?.headers ?? {}),
            },
          });
          const text = await response.text();
          let data: unknown = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = text;
          }
          return { ok: response.ok, status: response.status, data: data as any };
        };

        try {
          const me = await call("user");
          if (!me.ok) {
            return Response.json(
              { error: `GitHub rejected the request (${me.status}).` },
              { status: 502 },
            );
          }
          const owner = me.data?.login as string;

          // Create the repository when it does not exist yet.
          let existing = await call(`repos/${owner}/${repo}`);
          if (!existing.ok) {
            const created = await call("user/repos", {
              method: "POST",
              body: JSON.stringify({
                name: repo,
                description: body.description ?? "Built with Forge",
                private: body.private ?? false,
                auto_init: true,
              }),
            });
            if (!created.ok) {
              const message =
                (created.data?.errors?.[0]?.message as string) ??
                (created.data?.message as string) ??
                `status ${created.status}`;
              return Response.json({ error: `Could not create the repository: ${message}` }, { status: 502 });
            }
            existing = created;
          }

          const branch = (existing.data?.default_branch as string) || "main";

          // A brand-new repository has no commits yet: seed one so the Git API can be used.
          const initialRef = await call(`repos/${owner}/${repo}/git/ref/heads/${branch}`);
          if (!initialRef.ok) {
            const seed = await call(`repos/${owner}/${repo}/contents/README.md`, {
              method: "PUT",
              body: JSON.stringify({
                message: "Initial commit from Forge",
                content: toBase64(`# ${repo}\n\nBuilt with Forge.\n`),
                branch,
              }),
            });
            if (!seed.ok) {
              const detail = (seed.data?.["message"] as string) ?? `status ${seed.status}`;
              return Response.json(
                { error: `Could not initialise the repository: ${detail}` },
                { status: 502 },
              );
            }
          }

          // One commit containing every generated file.
          const blobs: { path: string; sha: string }[] = [];
          for (const file of files) {
            const blob = await call(`repos/${owner}/${repo}/git/blobs`, {
              method: "POST",
              body: JSON.stringify({ content: toBase64(file.content), encoding: "base64" }),
            });
            if (!blob.ok) {
              const detail = (blob.data?.["message"] as string) ?? `status ${blob.status}`;
              return Response.json(
                { error: `Upload failed for ${file.path}: ${detail}` },
                { status: 502 },
              );
            }
            blobs.push({ path: file.path.replace(/^\/+/, ""), sha: blob.data.sha as string });
          }

          const head = await call(`repos/${owner}/${repo}/git/ref/heads/${branch}`);
          const parent = head.ok ? (head.data?.object?.sha as string) : undefined;

          const tree = await call(`repos/${owner}/${repo}/git/trees`, {
            method: "POST",
            body: JSON.stringify({
              ...(parent ? { base_tree: parent } : {}),
              tree: blobs.map((blob) => ({
                path: blob.path,
                mode: "100644",
                type: "blob",
                sha: blob.sha,
              })),
            }),
          });
          if (!tree.ok) return Response.json({ error: "Could not build the commit." }, { status: 502 });

          const commit = await call(`repos/${owner}/${repo}/git/commits`, {
            method: "POST",
            body: JSON.stringify({
              message: parent ? "Update site from Forge" : "Initial commit from Forge",
              tree: tree.data.sha,
              parents: parent ? [parent] : [],
            }),
          });
          if (!commit.ok) return Response.json({ error: "Could not create the commit." }, { status: 502 });

          const refBody = JSON.stringify({ sha: commit.data.sha, force: true });
          const updated = head.ok
            ? await call(`repos/${owner}/${repo}/git/refs/heads/${branch}`, {
                method: "PATCH",
                body: refBody,
              })
            : await call(`repos/${owner}/${repo}/git/refs`, {
                method: "POST",
                body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.data.sha }),
              });
          if (!updated.ok) return Response.json({ error: "Could not push the commit." }, { status: 502 });

          return Response.json({
            url: `https://github.com/${owner}/${repo}`,
            repo: `${owner}/${repo}`,
            branch,
            files: files.length,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "GitHub push failed";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
