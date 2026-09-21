import { createFileRoute } from "@tanstack/react-router";

type File = { path: string; content: string };
type Body = { files?: File[] };

export const Route = createFileRoute("/api/sandbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["DAYTONA_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "No Daytona key is configured for this app." },
            { status: 500 },
          );
        }

        const body = (await request.json()) as Body;
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length === 0) {
          return Response.json({ error: "There are no files to run yet." }, { status: 400 });
        }

        const { Daytona } = await import("@daytona/sdk");
        const daytona = new Daytona({ apiKey });

        const sandbox = await daytona.create({ public: true, autoStopInterval: 60 });
        const root = await sandbox.getUserRootDir();

        for (const file of files) {
          const safe = file.path.replace(/^\/+/, "").replace(/\.\./g, "");
          await sandbox.fs.uploadFile(Buffer.from(file.content, "utf8"), `${root}/site/${safe}`);
        }

        const run = await sandbox.process.executeCommand(
          "nohup python3 -m http.server 3000 --directory site > /tmp/server.log 2>&1 & sleep 2; curl -sf -o /dev/null localhost:3000 && echo up",
          root,
        );
        if (!String(run.result ?? "").includes("up")) {
          return Response.json({ error: "The sandbox server did not start." }, { status: 502 });
        }

        const preview = await sandbox.getPreviewLink(3000);
        return Response.json({ url: preview.url, sandboxId: sandbox.id });
      },
    },
  },
});
