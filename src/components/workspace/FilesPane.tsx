import { Download, FileSpreadsheet, FileText, Loader2, Package, Presentation } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DOC_LABEL,
  downloadDoc,
  downloadFile,
  resolveDocImage,
  type DocAsset,
  type DocFormat,
  type DocSpec,
} from "@/lib/docs";
import type { ProjectFile } from "@/lib/files";

const FORMAT_ICON: Record<DocFormat, typeof FileText> = {
  docx: FileText,
  pdf: FileText,
  xlsx: FileSpreadsheet,
  pptx: Presentation,
};

export function FilesPane({ docs, files }: { docs: DocSpec[]; files: ProjectFile[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleDownload = async (spec: DocSpec, format: DocFormat) => {
    setBusy(`${spec.id}:${format}`);
    try {
      await downloadDoc(spec, format);
      toast.success(`${spec.name}.${format} downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the file.");
    } finally {
      setBusy(null);
    }
  };

  const downloadZip = async () => {
    setBusy("zip");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of files) zip.file(file.path, file.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "website.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setBusy(null);
    }
  };

  if (docs.length === 0 && files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <FileText className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Ask for a Word, Excel, PowerPoint or PDF document and it will appear here, ready to
          download.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      {docs.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Documents
          </h3>
          {docs.map((spec) => (
            <div key={spec.id} className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium">{spec.title}</p>
              {spec.subtitle && (
                <p className="mt-0.5 text-sm text-muted-foreground">{spec.subtitle}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {spec.sections.length} section{spec.sections.length === 1 ? "" : "s"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {spec.formats.map((format) => {
                  const Icon = FORMAT_ICON[format];
                  const loading = busy === `${spec.id}:${format}`;
                  return (
                    <Button
                      key={format}
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => void handleDownload(spec, format)}
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Icon />}
                      {DOC_LABEL[format]} .{format}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Website files
            </h3>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy === "zip"}
              onClick={() => void downloadZip()}
            >
              {busy === "zip" ? <Loader2 className="animate-spin" /> : <Package />}
              Download ZIP
            </Button>
          </div>
          {files.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="font-mono text-xs">{file.path}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadFile(file.path, file.content)}
              >
                <Download /> Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
