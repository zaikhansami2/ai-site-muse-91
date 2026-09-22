import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type Body = {
  name?: string;
  email?: string;
  message?: string;
  site?: string;
  webhook?: string;
};

export const Route = createFileRoute("/api/public/widget-lead")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const email = (body.email ?? "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return Response.json(
            { error: "A valid email is required." },
            { status: 400, headers: cors },
          );
        }

        const lead = {
          name: (body.name ?? "").slice(0, 120),
          email,
          message: (body.message ?? "").slice(0, 2000),
          site: (body.site ?? "").slice(0, 200),
          receivedAt: new Date().toISOString(),
        };

        // Forward to the owner's webhook (Zapier, Make, Slack, CRM) when one is configured.
        const webhook = body.webhook;
        if (webhook && /^https:\/\//.test(webhook)) {
          try {
            await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(lead),
            });
          } catch {
            return Response.json(
              { ok: false, error: "The lead could not be delivered." },
              { status: 502, headers: cors },
            );
          }
        }

        console.log("widget lead", lead);
        return Response.json({ ok: true }, { headers: cors });
      },
    },
  },
});
