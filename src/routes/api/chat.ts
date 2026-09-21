import { createFileRoute } from "@tanstack/react-router";
import { streamText, type ModelMessage } from "ai";

import { getLovableModel } from "@/lib/ai-gateway.server";
import { systemPrompt, type Mode } from "@/lib/prompts";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

type Body = { mode?: Mode; messages?: IncomingMessage[] };

function toModelMessages(messages: IncomingMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (message.role === "user" && message.image) {
      return {
        role: "user",
        content: [
          { type: "text", text: message.content || "Build this." },
          { type: "image", image: message.image },
        ],
      } as ModelMessage;
    }
    return { role: message.role, content: message.content } as ModelMessage;
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const mode: Mode = body.mode ?? "build";
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }

        try {
          const result = streamText({
            model: getLovableModel(),
            system: systemPrompt(mode),
            messages: toModelMessages(messages),
            providerOptions: {
              openai: {
                forceReasoning: true,
                reasoningEffort: mode === "chat" ? "low" : "medium",
                store: false,
              },
            },
          });

          return result.toTextStreamResponse();
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI request failed";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
