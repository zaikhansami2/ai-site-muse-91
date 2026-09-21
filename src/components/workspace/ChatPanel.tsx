import { motion } from "motion/react";
import { marked } from "marked";
import {
  ArrowUp,
  ImagePlus,
  Loader2,
  MessageSquare,
  Hammer,
  ListChecks,
  Square,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { stripFiles } from "@/lib/files";
import type { Mode } from "@/lib/prompts";
import type { ChatMessage } from "@/lib/storage";
import type { Status } from "@/hooks/use-builder";
import { cn } from "@/lib/utils";

const MODES: { key: Mode; label: string; icon: typeof MessageSquare; hint: string }[] = [
  { key: "chat", label: "Chat", icon: MessageSquare, hint: "Talk through ideas, no code" },
  { key: "plan", label: "Plan", icon: ListChecks, hint: "Checklist + architecture first" },
  { key: "build", label: "Build", icon: Hammer, hint: "Write and update the site" },
];

const CHIPS = [
  "SaaS landing page for an AI note-taker",
  "Portfolio for a product designer",
  "Pricing page with 3 tiers and FAQ",
  "Restaurant site with menu and booking",
];

const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  analyzing: "Analyzing request…",
  building: "Building components…",
  formatting: "Formatting files…",
  error: "Something went wrong",
};

export function ChatPanel({
  messages,
  mode,
  setMode,
  status,
  error,
  busy,
  onSend,
  onStop,
}: {
  messages: ChatMessage[];
  mode: Mode;
  setMode: (mode: Mode) => void;
  status: Status;
  error: string | null;
  busy: boolean;
  onSend: (text: string, image?: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  const submit = () => {
    if (busy || (!input.trim() && !image)) return;
    onSend(input, image ?? undefined);
    setInput("");
    setImage(null);
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex items-center gap-1 border-b border-border p-2">
        {MODES.map(({ key, label, icon: Icon, hint }) => (
          <button
            key={key}
            title={hint}
            onClick={() => setMode(key)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              mode === key
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === key && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-lg bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="relative size-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <EmptyState onPick={(text) => setInput(text)} />
        ) : (
          <div className="space-y-5">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {busy && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            {STATUS_LABEL[status] || "Working…"}
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        {image && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
            <img src={image} alt="Attached reference" className="size-12 rounded object-cover" />
            <span className="flex-1 text-xs text-muted-foreground">
              Screenshot attached — it will be turned into code.
            </span>
            <button onClick={() => setImage(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="rounded-xl border border-border bg-surface focus-within:border-primary/60">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder={
              mode === "chat"
                ? "Ask anything about your website idea…"
                : mode === "plan"
                  ? "Describe the site and get a build plan…"
                  : "Describe the website you want to build…"
            }
            className="min-h-[76px] w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => pickImage(event.target.files?.[0])}
              />
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" />
                Screenshot
              </Button>
            </div>
            {busy ? (
              <Button size="sm" variant="secondary" onClick={onStop}>
                <Square className="size-3.5" />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={submit} disabled={!input.trim() && !image}>
                <ArrowUp className="size-4" />
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="pt-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        What are we shipping today?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Describe it, sketch it on the canvas, or drop a screenshot — the builder writes the files and
        renders them live.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onPick(chip)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const html = useMemo(() => {
    if (message.role !== "assistant") return "";
    const text = message.mode === "build" ? stripFiles(message.content) : message.content;
    return marked.parse(text || "", { async: false }) as string;
  }, [message]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
          {message.image && (
            <img src={message.image} alt="" className="mb-2 max-h-40 rounded-lg object-contain" />
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
        {message.mode}
      </p>
      <div
        className="prose-chat space-y-3 leading-relaxed text-foreground/90"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
