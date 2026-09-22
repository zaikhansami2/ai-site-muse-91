import { Camera, Clapperboard, Image as ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  captureThumbnail,
  composeOgCard,
  downloadBlob,
  downloadDataUrl,
  recordShowcase,
} from "@/lib/capture";
import { buildPreviewDocument, type ProjectFile } from "@/lib/files";

function slug(name: string) {
  return (
    name
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || "website"
  );
}

export function ShowcaseDialog({
  files,
  siteName,
  thumbnail,
  onThumbnail,
}: {
  files: ProjectFile[];
  siteName: string;
  thumbnail?: string;
  onThumbnail: (dataUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<string | null>(thumbnail ?? null);
  const [busy, setBusy] = useState<"shot" | "og" | "video" | null>(null);
  const [progress, setProgress] = useState(0);

  const ensureShot = async () => {
    if (shot) return shot;
    if (files.length === 0) throw new Error("Generate a site first — there is nothing to capture.");
    const dataUrl = await captureThumbnail(buildPreviewDocument(files));
    setShot(dataUrl);
    onThumbnail(dataUrl);
    return dataUrl;
  };

  const run = async (kind: "shot" | "og" | "video") => {
    setBusy(kind);
    try {
      if (kind === "shot") {
        setShot(null);
        const dataUrl = await captureThumbnail(buildPreviewDocument(files));
        setShot(dataUrl);
        onThumbnail(dataUrl);
        toast.success("Thumbnail captured.");
      } else if (kind === "og") {
        const base = await ensureShot();
        const card = await composeOgCard(base, siteName, "Built with Forge");
        downloadDataUrl(card, `${slug(siteName)}-og.png`);
        toast.success("Social preview image downloaded.");
      } else {
        const base = await ensureShot();
        setProgress(0);
        const blob = await recordShowcase(base, siteName, "Built with Forge", 7000, (ratio) =>
          setProgress(Math.round(ratio * 100)),
        );
        downloadBlob(blob, `${slug(siteName)}-showcase.webm`);
        toast.success("Showcase video downloaded.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Camera className="size-4" />
          <span className="hidden lg:inline">Showcase</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thumbnail &amp; showcase video</DialogTitle>
          <DialogDescription>
            Capture a picture of your site, turn it into a social sharing image, or record a short
            animated clip for marketing.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {shot ? (
            <img src={shot} alt={`${siteName} preview`} className="w-full" />
          ) : (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
              {busy === "shot" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" /> Capturing…
                </span>
              ) : (
                "No capture yet"
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("shot")}
          >
            <Camera className="size-4" />
            {shot ? "Recapture" : "Capture thumbnail"}
          </Button>
          <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => run("og")}>
            <ImageIcon className="size-4" />
            Social image
          </Button>
          <Button size="sm" disabled={busy !== null} onClick={() => run("video")}>
            {busy === "video" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Clapperboard className="size-4" />
            )}
            {busy === "video" ? `Recording ${progress}%` : "Record video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
