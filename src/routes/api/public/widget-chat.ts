import { createFileRoute } from "@tanstack/react-router";
import { streamText, type ModelMessage } from "ai";

import { getLovableModel } from "@/lib/ai-gateway.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type Body = {
  messages?: { role: "user" | "assistant"; content: string }[];
  context?: string;
  business?: string;
};

export const Route = createFileRoute("/api/public/widget-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-12);
        if (messages.length === 0) {
          return new Response("Messages are required", { status: 400, headers: cors });
        }

        const system = [
          `You are the friendly support assistant for ${body.business || "this website"}.`,
          "Answer questions about the business using only the page content below.",
          "Keep answers to two or three short sentences, plain text, no markdown.",
          "If the answer is not in the content, say so briefly and offer to take the visitor's email so the team can follow up.",
          "",
          "PAGE CONTENT:",
          (body.context ?? "").slice(0, 12000),
        ].join("\n");

        try {
          const result = streamText({
            model: getLovableModel(),
            system,
            messages: messages.map((message) => ({
              role: message.role,
              content: message.content,
            })) as ModelMessage[],
            providerOptions: {
              openai: { forceReasoning: true, reasoningEffort: "low", store: false },
            },
          });
          const response = result.toTextStreamResponse();
          const headers = new Headers(response.headers);
          for (const [key, value] of Object.entries(cors)) headers.set(key, value);
          return new Response(response.body, { status: response.status, headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Assistant unavailable";
          return new Response(message, { status: 500, headers: cors });
        }
      },
    },
  },
});
