import { createFileRoute } from "@tanstack/react-router";
import { Code2, Eye, PencilRuler } from "lucide-react";
import { useState } from "react";

import { ChatPanel } from "@/components/workspace/ChatPanel";
import { CodePane } from "@/components/workspace/CodePane";
import { PreviewPane } from "@/components/workspace/PreviewPane";
import { SketchCanvas } from "@/components/workspace/SketchCanvas";
import { TopBar } from "@/components/workspace/TopBar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useBuilder } from "@/hooks/use-builder";
import { SKETCH_PROMPT } from "@/lib/prompts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — AI Website Builder Workspace" },
      {
        name: "description",
        content:
          "Describe, sketch or screenshot a website and watch Forge generate multi-file code with a live preview, code editor and one-click ZIP export.",
      },
      { property: "og:title", content: "Forge — AI Website Builder Workspace" },
      {
        property: "og:description",
        content:
          "AI chat on the left, live preview and code editor on the right. Build complete websites from a prompt, a sketch or a screenshot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

const TABS = [
  { key: "preview", label: "Preview", icon: Eye },
  { key: "code", label: "Code", icon: Code2 },
  { key: "canvas", label: "Canvas", icon: PencilRuler },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Workspace() {
  const builder = useBuilder();
  const [tab, setTab] = useState<TabKey>("preview");
  const files = builder.active?.files ?? [];
  const busy = builder.status !== "idle" && builder.status !== "error";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        projects={builder.projects}
        active={builder.active}
        onSelect={builder.setActiveId}
        onCreate={builder.createProject}
        onDelete={builder.deleteProject}
        onRename={builder.renameProject}
        files={files}
      />

      <ResizablePanelGroup className="min-h-0 flex-1">
        <ResizablePanel defaultSize={38} minSize={26}>
          <ChatPanel
            messages={builder.active?.messages ?? []}
            mode={builder.mode}
            setMode={builder.setMode}
            status={builder.status}
            error={builder.error}
            busy={busy}
            onSend={(text, image) => {
              if (builder.mode === "build") setTab("preview");
              void builder.send(text, image ? { image } : undefined);
            }}
            onStop={builder.stop}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={62} minSize={30}>
          <div className="flex h-full min-h-0 flex-col bg-surface">
            <div className="flex items-center gap-1 border-b border-border px-3 py-2">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === key
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
              {files.length > 0 && (
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {tab === "preview" && <PreviewPane files={files} />}
              {tab === "code" && <CodePane files={files} />}
              {tab === "canvas" && (
                <SketchCanvas
                  busy={busy}
                  onGenerate={(dataUrl) => {
                    setTab("preview");
                    void builder.send(SKETCH_PROMPT, { image: dataUrl, mode: "build" });
                  }}
                />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
