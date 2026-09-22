import { createFileRoute } from "@tanstack/react-router";
import { Code2, Eye, FolderDown } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import balloonAsset from "@/assets/balloon-loop-fast.mp4.asset.json";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { PreviewPane } from "@/components/workspace/PreviewPane";
import { TopBar } from "@/components/workspace/TopBar";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useBuilder } from "@/hooks/use-builder";
import { cn } from "@/lib/utils";

// Heavy editor/files panes load on demand so the workspace opens instantly.
const CodePane = lazy(() =>
  import("@/components/workspace/CodePane").then((m) => ({ default: m.CodePane })),
);
const FilesPane = lazy(() =>
  import("@/components/workspace/FilesPane").then((m) => ({ default: m.FilesPane })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — AI Website Builder" },
      {
        name: "description",
        content: "Chat, plan and build complete websites with Forge's AI workspace.",
      },
      { property: "og:title", content: "Forge — AI Website Builder" },
      {
        property: "og:description",
        content: "A focused AI chat that turns ideas, plans and references into complete websites.",
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
  { key: "files", label: "Files", icon: FolderDown },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type BackgroundMedia = { url: string; type: "video" | "image"; custom: boolean };

function PaneFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function Workspace() {
  const builder = useBuilder();
  const [tab, setTab] = useState<TabKey>("preview");
  const [background, setBackground] = useState<BackgroundMedia>({
    url: balloonAsset.url,
    type: "video",
    custom: false,
  });
  const files = builder.active?.files ?? [];
  const docs = builder.active?.docs ?? [];
  const showBuilder = builder.mode === "build" || builder.builderOpen || docs.length > 0;
  const busy = builder.status !== "idle" && builder.status !== "error";

  // A new office document jumps straight to the Files tab, ready to download.
  const docCount = useRef(0);
  useEffect(() => {
    if (docs.length > docCount.current) setTab("files");
    docCount.current = docs.length;
  }, [docs.length]);

  useEffect(
    () => () => {
      if (background.custom) URL.revokeObjectURL(background.url);
    },
    [background],
  );

  const chooseBackground = (file: File) => {
    setBackground((current) => {
      if (current.custom) URL.revokeObjectURL(current.url);
      return {
        url: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" : "image",
        custom: true,
      };
    });
  };

  const chat = (
    <ChatPanel
      messages={builder.active?.messages ?? []}
      projects={builder.projects}
      activeId={builder.activeId}
      mode={builder.mode}
      lastMode={builder.lastMode}
      setMode={(next) => {
        builder.setMode(next);
        if (next === "build") builder.setBuilderOpen(true);
        if (next === "chat" || next === "plan") builder.setBuilderOpen(false);
      }}
      research={builder.research}
      setResearch={builder.setResearch}
      status={builder.status}
      error={builder.error}
      busy={busy}
      onSend={(text, image, imageName) => {
        setTab("preview");
        void builder.send(text, image ? { image, ...(imageName ? { imageName } : {}) } : undefined);
      }}
      onStop={builder.stop}
      onSelect={builder.setActiveId}
      onCreate={builder.createProject}
      onDelete={builder.deleteProject}
      onBackgroundFile={chooseBackground}
    />
  );

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      {background.type === "video" ? (
        <video
          className="absolute inset-0 size-full object-cover"
          src={background.url}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          className="absolute inset-0 size-full object-cover"
          src={background.url}
          alt="Workspace background"
        />
      )}
      <div className="absolute inset-0 bg-background/20" />

      <div className="relative z-10 flex h-full flex-col">
        {!showBuilder ? (
          chat
        ) : (
          <>
            <TopBar
              projects={builder.projects}
              active={builder.active}
              onSelect={builder.setActiveId}
              onCreate={builder.createProject}
              onDelete={builder.deleteProject}
              onRename={builder.renameProject}
              onFilesChange={builder.setFiles}
              onThumbnail={builder.setThumbnail}
              files={files}
            />
            <ResizablePanelGroup className="min-h-0 flex-1">
              <ResizablePanel defaultSize={44} minSize={32}>
                {chat}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={56} minSize={34}>
                <div className="flex h-full min-h-0 flex-col bg-background/88 backdrop-blur-xl">
                  <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                    {TABS.map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant="ghost"
                        size="sm"
                        onClick={() => setTab(key)}
                        className={cn(
                          tab === key
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <Icon /> {label}
                      </Button>
                    ))}
                    {files.length > 0 && (
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                        {files.length} file{files.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="min-h-0 flex-1">
                    {tab === "preview" && <PreviewPane files={files} building={busy} />}
                    {tab === "code" && (
                      <Suspense fallback={<PaneFallback />}>
                        <CodePane files={files} onFilesChange={builder.setFiles} />
                      </Suspense>
                    )}
                    {tab === "files" && (
                      <Suspense fallback={<PaneFallback />}>
                        <FilesPane
                          docs={docs}
                          files={files}
                          assets={builder.active?.assets ?? []}
                        />
                      </Suspense>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </>
        )}
      </div>
    </div>
  );
}
