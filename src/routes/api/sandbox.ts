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

        // Daytona's Node-only SDK crashes the edge production runtime during
        // application startup. Keep the route safe until Daytona exposes an
        // edge-compatible HTTP flow; the built-in preview remains available.
        return Response.json(
          { error: "Cloud sandbox is temporarily unavailable. Use Preview to test this site." },
          { status: 503 },
        );
      },
    },
  },
});
