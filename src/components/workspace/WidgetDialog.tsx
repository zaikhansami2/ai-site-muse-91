import { Bot, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectFile } from "@/lib/files";
import { hasWidget, injectWidget, removeWidget } from "@/lib/widget";

export function WidgetDialog({
  files,
  siteName,
  onApply,
}: {
  files: ProjectFile[];
  siteName: string;
  onApply: (files: ProjectFile[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [business, setBusiness] = useState(siteName);
  const [welcome, setWelcome] = useState(
    "Hi! Ask me anything about us — or leave your email and we'll reach out.",
  );
  const [accent, setAccent] = useState("#2fe0c0");
  const [webhook, setWebhook] = useState("");

  const installed = hasWidget(files);

  const apply = () => {
    if (files.length === 0) {
      toast.error("Generate a site first — there is nothing to add the chatbot to.");
      return;
    }
    onApply(
      injectWidget(files, {
        business: business.trim() || siteName,
        welcome: welcome.trim(),
        accent,
        webhook: webhook.trim(),
        endpoint: window.location.origin,
      }),
    );
    setOpen(false);
    toast.success("Chatbot added to your site", {
      description: "It answers from your page content and captures emails.",
    });
  };

  const remove = () => {
    onApply(removeWidget(files));
    setOpen(false);
    toast.success("Chatbot removed from your site.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Bot className="size-4" />
          <span className="hidden lg:inline">{installed ? "Chatbot ✓" : "Chatbot"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a support chatbot</DialogTitle>
          <DialogDescription>
            A floating chat bubble is added to every page. It answers visitor questions using your
            own site content and can collect names and email addresses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="widget-business">Business name</Label>
            <Input
              id="widget-business"
              value={business}
              onChange={(event) => setBusiness(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="widget-welcome">Welcome message</Label>
            <Input
              id="widget-welcome"
              value={welcome}
              onChange={(event) => setWelcome(event.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="widget-accent">Colour</Label>
              <Input
                id="widget-accent"
                type="color"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="h-9 w-16 p-1"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="widget-webhook">Send new leads to (optional)</Label>
              <Input
                id="widget-webhook"
                placeholder="https://hooks.zapier.com/..."
                value={webhook}
                onChange={(event) => setWebhook(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {installed ? (
            <Button variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={apply}>{installed ? "Update chatbot" : "Add chatbot"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
