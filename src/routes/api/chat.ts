import { createFileRoute } from "@tanstack/react-router";
import { streamText, type ModelMessage } from "ai";

import { getLovableModel } from "@/lib/ai-gateway.server";
import { assetContext, editContext, systemPrompt, type Mode } from "@/lib/prompts";
import { researchContext } from "@/lib/research.server";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

type Body = {
  mode?: Mode;
  messages?: IncomingMessage[];
  research?: boolean;
  files?: { path: string; content: string }[];
  assets?: { token: string; name: string }[];
};

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

        let research = "";
        if (body.research) {
          const lastUser = [...messages].reverse().find((message) => message.role === "user");
          if (lastUser?.content) {
            try {
              research = await researchContext(lastUser.content);
            } catch {
              research = "";
            }
          }
        }

        const existing = Array.isArray(body.files) ? body.files : [];
        const assets = Array.isArray(body.assets) ? body.assets : [];
        const parts = [systemPrompt(mode)];
        if (mode === "build" && existing.length > 0) parts.push(editContext(existing));
        if (mode === "build" && assets.length > 0) parts.push(assetContext(assets));
        if (research) parts.push(research);
        const system = parts.join("\n\n");

        try {
          const result = streamText({
            model: getLovableModel(),
            system,
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
