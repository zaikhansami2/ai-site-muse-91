import { Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildPreviewDocument, type ProjectFile } from "@/lib/files";
import { cn } from "@/lib/utils";

const VIEWPORTS = {
  mobile: { label: "Mobile", width: 390, icon: Smartphone },
  tablet: { label: "Tablet", width: 834, icon: Tablet },
  desktop: { label: "Desktop", width: 0, icon: Monitor },
} as const;

type ViewportKey = keyof typeof VIEWPORTS;

export function PreviewPane({ files }: { files: ProjectFile[] }) {
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  const [nonce, setNonce] = useState(0);
  const doc = useMemo(() => buildPreviewDocument(files), [files]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-surface-raised p-1">
          {(Object.keys(VIEWPORTS) as ViewportKey[]).map((key) => {
            const { label, icon: Icon } = VIEWPORTS[key];
            return (
              <button
                key={key}
                onClick={() => setViewport(key)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewport === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setNonce((n) => n + 1)}>
          <RotateCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-1 justify-center overflow-auto bg-surface-raised p-4">
        {doc ? (
          <iframe
            key={nonce}
            title="Live preview"
            srcDoc={doc}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="h-full w-full rounded-lg border border-border bg-card shadow-xl"
            style={
              VIEWPORTS[viewport].width
                ? { width: VIEWPORTS[viewport].width, maxWidth: "100%" }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p className="font-display text-base text-foreground">Nothing to preview yet</p>
            <p className="mt-1 max-w-xs">
              Describe the site you want in Build mode and it will render here live.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
