import { createFileRoute } from "@tanstack/react-router";
import JSZip from "jszip";

type File = { path: string; content: string };
type Body = { name?: string; files?: File[] };

const NETLIFY = "https://api.netlify.com/api/v1";

export const Route = createFileRoute("/api/deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["NETLIFY_API_TOKEN"];
        if (!token) {
          return Response.json(
            { error: "No Netlify token is configured for this app." },
            { status: 500 },
          );
        }

        const body = (await request.json()) as Body;
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length === 0) {
          return Response.json({ error: "There are no files to deploy yet." }, { status: 400 });
        }

        const auth = { Authorization: `Bearer ${token}` };

        const siteRes = await fetch(`${NETLIFY}/sites`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${slug(body.name ?? "forge-site")}-${Math.random().toString(36).slice(2, 7)}`,
          }),
        });

        if (!siteRes.ok) {
          const detail = await siteRes.text();
          return Response.json(
            { error: `Netlify could not create the site: ${detail.slice(0, 300)}` },
            { status: siteRes.status },
          );
        }

        const site = (await siteRes.json()) as { id: string; ssl_url?: string; url?: string };

        const zip = new JSZip();
        for (const file of files) zip.file(file.path, file.content);
        const archive = await zip.generateAsync({ type: "arraybuffer" });

        const deployRes = await fetch(`${NETLIFY}/sites/${site.id}/deploys`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/zip" },
          body: archive,
        });

        if (!deployRes.ok) {
          const detail = await deployRes.text();
          return Response.json(
            { error: `Netlify rejected the upload: ${detail.slice(0, 300)}` },
            { status: deployRes.status },
          );
        }

        const deploy = (await deployRes.json()) as { ssl_url?: string; deploy_ssl_url?: string };
        const url = deploy.ssl_url ?? site.ssl_url ?? deploy.deploy_ssl_url ?? site.url;

        return Response.json({ url });
      },
    },
  },
});

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "forge-site"
  );
}
