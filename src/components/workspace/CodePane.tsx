import { Check, Copy, FileCode2, FileJson, FileText, Hash, Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { languageOf, type ProjectFile } from "@/lib/files";
import { formatAll, isFormattable } from "@/lib/format";
import { cn } from "@/lib/utils";

function iconFor(path: string) {
  const lang = languageOf(path);
  if (lang === "html") return FileCode2;
  if (lang === "css") return Hash;
  if (lang === "json") return FileJson;
  return FileText;
}

export function CodePane({
  files,
  onFilesChange,
}: {
  files: ProjectFile[];
  onFilesChange?: (files: ProjectFile[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formatting, setFormatting] = useState(false);

  useEffect(() => {
    if (files.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !files.some((f) => f.path === selected)) {
      setSelected(files[0]!.path);
    }
  }, [files, selected]);

  const current = files.find((f) => f.path === selected) ?? null;

  const copy = async () => {
    if (!current) return;
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const format = async () => {
    if (!onFilesChange || files.length === 0) return;
    setFormatting(true);
    try {
      onFilesChange(await formatAll(files));
      toast.success("Code tidied up.");
    } catch {
      toast.error("That code could not be formatted.");
    } finally {
      setFormatting(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
        <p className="font-display text-base text-foreground">No files yet</p>
        <p className="mt-1 max-w-xs">Generated files appear here with a full file tree.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-52 shrink-0 overflow-y-auto border-r border-border bg-sidebar p-2">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Files
        </p>
        {files.map((file) => {
          const Icon = iconFor(file.path);
          return (
            <button
              key={file.path}
              onClick={() => setSelected(file.path)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                selected === file.path
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0 text-primary" />
              <span className="truncate font-mono text-xs">{file.path}</span>
            </button>
          );
        })}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="truncate font-mono text-xs text-muted-foreground">{current?.path}</span>
          <div className="flex items-center gap-1">
            {onFilesChange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={format}
                disabled={formatting || !current || !isFormattable(current.path)}
              >
                {formatting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                Format
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto bg-surface-raised p-4 text-xs leading-relaxed">
          <code className="font-mono text-foreground/90">{current?.content}</code>
        </pre>
      </div>
    </div>
  );
}
