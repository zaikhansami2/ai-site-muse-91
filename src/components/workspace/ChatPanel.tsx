import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Status } from "@/hooks/use-builder";
import { stripFiles } from "@/lib/files";
import type { Mode } from "@/lib/prompts";
import type { ChatMessage, Project } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  Bot,
  Check,
  ChevronDown,
  Globe2,
  Hammer,
  ImagePlus,
  ListChecks,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MODES: { key: Mode; label: string; icon: typeof MessageSquare }[] = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "plan", label: "Plan", icon: ListChecks },
  { key: "build", label: "Builder", icon: Hammer },
];

const CHIPS = [
  "Help me shape my website idea",
  "Plan a polished SaaS website",
  "Build a portfolio for a product designer",
  "Create a restaurant site with booking",
];

export function ChatPanel({
  messages,
  projects,
  activeId,
  mode,
  setMode,
  research,
  setResearch,
  status,
  error,
  busy,
  onSend,
  onStop,
  onSelect,
  onCreate,
  onDelete,
  onBackgroundFile,
}: {
  messages: ChatMessage[];
  projects: Project[];
  activeId: string | null;
  mode: Mode;
  setMode: (mode: Mode) => void;
  research: boolean;
  setResearch: (value: boolean) => void;
  status: Status;
  error: string | null;
  busy: boolean;
  onSend: (text: string, image?: string) => void;
  onStop: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onBackgroundFile: (file: File) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const backgroundRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy, activeId]);

  const submit = async (text: string, image?: string) => {
    if (busy || (!text.trim() && !image)) return;
    onSend(text, image);
    setInput("");
  };

  const submitImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void submit(input, String(reader.result));
    reader.readAsDataURL(file);
  };

  const chatStatus = status === "error" ? "error" : busy ? "streaming" : "ready";

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <aside
        className={cn(
          "relative z-20 flex shrink-0 flex-col border-r border-border/70 bg-background/80 backdrop-blur-xl transition-[width] duration-200",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
            F
          </div>
          <span className="font-display text-base font-semibold">Forge</span>
          <Button className="ml-auto" size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} title="Close chats">
            <PanelLeftClose />
          </Button>
        </div>
        <div className="px-3 pb-3">
          <Button className="w-full justify-start" variant="outline" onClick={onCreate}>
            <Plus /> New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Recent chats</p>
          {projects.map((project) => (
            <div key={project.id} className={cn("group flex items-center rounded-md", project.id === activeId && "bg-accent")}>
              <button
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                onClick={() => onSelect(project.id)}
              >
                {project.name}
              </button>
              <Button
                className="mr-1 opacity-0 group-hover:opacity-100"
                size="icon"
                variant="ghost"
                onClick={() => onDelete(project.id)}
                title="Delete chat"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <div className="border-t border-border/70 p-3 text-xs text-muted-foreground">Saved in this browser</div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col bg-background/65 backdrop-blur-sm">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-4">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} title="Open chats">
                <Menu />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 font-semibold">
                  {MODES.find((item) => item.key === mode)?.label}
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {MODES.map(({ key, label, icon: Icon }) => (
                  <DropdownMenuItem key={key} onSelect={() => setMode(key)}>
                    <Icon />
                    <span className="flex-1">{label}</span>
                    {mode === key && <Check className="text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" title="Background options">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => backgroundRef.current?.click()}>
                <Video /> Choose video or image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={backgroundRef}
            hidden
            type="file"
            accept="video/*,image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onBackgroundFile(file);
              event.currentTarget.value = "";
            }}
          />
        </header>

        <Conversation className="min-h-0">
          <ConversationContent className="mx-auto w-full max-w-3xl px-5 pb-36 pt-10">
            {messages.length === 0 ? (
              <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                <div className="mb-5 flex size-12 items-center justify-center rounded-lg border border-border bg-background/80 shadow-sm">
                  <Bot className="size-6 text-primary" />
                </div>
                <h1 className="font-display text-3xl font-semibold sm:text-4xl">What can I help you create?</h1>
                <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                  Talk through an idea, make a clear plan, or switch to Builder when you are ready.
                </p>
                <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                  {CHIPS.map((chip) => (
                    <Button key={chip} variant="outline" className="h-auto justify-start bg-background/70 px-4 py-3 text-left whitespace-normal" onClick={() => setInput(chip)}>
                      {chip}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent className={cn(message.role === "user" && "bg-primary text-primary-foreground")}>
                    {message.image && <img src={message.image} alt="Attached reference" className="max-h-72 rounded-md object-contain" />}
                    {message.role === "assistant" ? (
                      <MessageResponse>{message.mode === "build" ? stripFiles(message.content) : message.content}</MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </MessageContent>
                </Message>
              ))
            )}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shimmer>{status === "analyzing" ? "Thinking…" : status === "formatting" ? "Finishing your site…" : "Creating…"}</Shimmer>
              </div>
            )}
            {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="absolute inset-x-0 bottom-0 z-20 bg-background/80 px-4 pb-4 pt-3 backdrop-blur-xl">
          <PromptInput
            accept="image/*"
            maxFiles={1}
            className="mx-auto max-w-3xl rounded-lg border-border bg-background shadow-lg"
            onSubmit={(message) => {
              const image = message.files[0]?.url;
              if (image) {
                void fetch(image).then((response) => response.blob()).then((blob) => {
                  const reader = new FileReader();
                  reader.onload = () => void submit(message.text, String(reader.result));
                  reader.readAsDataURL(blob);
                });
              } else {
                void submit(message.text);
              }
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={mode === "build" ? "Describe the website you want to build…" : mode === "plan" ? "What should we plan?" : "Message Forge…"}
            />
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton tooltip="Attach a screenshot" onClick={() => uploadRef.current?.click()}>
                  <ImagePlus />
                </PromptInputButton>
                <PromptInputButton
                  tooltip="Search the live web"
                  onClick={() => setResearch(!research)}
                  className={cn(research && "bg-accent text-primary")}
                >
                  <Globe2 />
                </PromptInputButton>
                <span className="ml-1 text-xs text-muted-foreground">{mode === "build" ? "Builder" : mode === "plan" ? "Plan" : "Chat"}</span>
              </PromptInputTools>
              <PromptInputSubmit status={chatStatus} onStop={onStop} disabled={!busy && !input.trim()} />
            </PromptInputFooter>
          </PromptInput>
          <input ref={uploadRef} hidden type="file" accept="image/*" onChange={(event) => submitImage(event.target.files?.[0])} />
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">Forge can make mistakes. Check important details.</p>
        </div>
      </main>
    </div>
  );
}