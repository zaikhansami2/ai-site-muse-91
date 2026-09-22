import { createFileRoute } from "@tanstack/react-router";

import { extractPage, searchWeb } from "@/lib/research.server";

type Body = { query?: string; url?: string };

export const Route = createFileRoute("/api/research")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;

        if (body.url) {
          const page = await extractPage(body.url);
          if (!page)
            return Response.json({ error: "That page could not be read." }, { status: 502 });
          return Response.json({ page });
        }

        const query = (body.query ?? "").trim();
        if (!query) return Response.json({ error: "A search query is required." }, { status: 400 });

        return Response.json({ results: await searchWeb(query, 6) });
      },
    },
  },
});
