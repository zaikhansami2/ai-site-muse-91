import { Download, Github, Plus, Rocket, Terminal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectFile } from "@/lib/files";
import type { Project } from "@/lib/storage";

export function TopBar({
  projects,
  active,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  files,
}: {
  projects: Project[];
  active: Project | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (name: string) => void;
  files: ProjectFile[];
}) {
  const [deploying, setDeploying] = useState(false);
  const [booting, setBooting] = useState(false);

  const runSandbox = async () => {
    if (files.length === 0) {
      toast.error("Generate a site first — there is nothing to run.");
      return;
    }
    setBooting(true);
    const toastId = toast.loading("Starting a live sandbox…");
    try {
      const response = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "The sandbox failed to start.");
      toast.success("Sandbox running", {
        id: toastId,
        description: data.url,
        action: { label: "Open", onClick: () => window.open(data.url, "_blank") },
        duration: 15000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The sandbox failed to start.", {
        id: toastId,
      });
    } finally {
      setBooting(false);
    }
  };

  const deploy = async () => {
    if (files.length === 0) {
      toast.error("Generate a site first — there is nothing to publish.");
      return;
    }
    setDeploying(true);
    const toastId = toast.loading("Publishing to Netlify…");
    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: active?.name ?? "forge-site", files }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Publishing failed.");
      toast.success("Your site is live", {
        id: toastId,
        description: data.url,
        action: { label: "Open", onClick: () => window.open(data.url, "_blank") },
        duration: 15000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publishing failed.", { id: toastId });
    } finally {
      setDeploying(false);
    }
  };

  const download = async () => {
    if (files.length === 0) {
      toast.error("Generate a site first — there are no files to export.");
      return;
    }
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(active?.name ?? "website").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Project downloaded as a ZIP.");
  };

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-sidebar px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary font-display text-sm font-bold text-primary-foreground">
          F
        </div>
        <span className="font-display text-sm font-semibold tracking-tight">Forge</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">/</span>
        <input
          value={active?.name ?? ""}
          onChange={(event) => onRename(event.target.value)}
          className="min-w-0 max-w-[220px] flex-1 truncate rounded-md bg-transparent px-1.5 py-1 text-sm outline-none hover:bg-accent/50 focus:bg-accent/50"
        />
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Projects ({projects.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => onSelect(project.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{project.name}</span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(project.id);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={onCreate}>
          <Plus className="size-4" />
          New
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast("GitHub push and Netlify deploy are coming in the next pass.")}
        >
          <Github className="size-4" />
          <span className="hidden md:inline">Push</span>
        </Button>
        <Button variant="ghost" size="sm" disabled={booting} onClick={runSandbox}>
          <Terminal className={booting ? "size-4 animate-pulse" : "size-4"} />
          <span className="hidden md:inline">{booting ? "Starting…" : "Sandbox"}</span>
        </Button>
        <Button variant="ghost" size="sm" disabled={deploying} onClick={deploy}>
          <Rocket className={deploying ? "size-4 animate-pulse" : "size-4"} />
          <span className="hidden md:inline">{deploying ? "Publishing…" : "Deploy"}</span>
        </Button>
        <Button size="sm" onClick={download}>
          <Download className="size-4" />
          Download ZIP
        </Button>
      </div>
    </header>
  );
}
