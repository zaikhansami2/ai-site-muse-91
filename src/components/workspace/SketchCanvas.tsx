import { Eraser, PenLine, Sparkle, Square, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "pen" | "box" | "label";

/**
 * Lightweight draw-to-code whiteboard: sketch a wireframe, then hand the PNG to
 * the build model as a vision prompt.
 */
export function SketchCanvas({
  onGenerate,
  busy,
}: {
  onGenerate: (dataUrl: string) => void;
  busy: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("pen");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const ctx2d = () => canvasRef.current!.getContext("2d")!;

  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(event);
    start.current = p;
    drawing.current = true;
    setDirty(true);
    const ctx = ctx2d();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    if (tool === "pen") {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    if (tool === "label") {
      const text = window.prompt("Label this region (e.g. hero, nav, pricing)");
      drawing.current = false;
      if (!text) return;
      ctx.fillStyle = "#111827";
      ctx.font = "16px ui-sans-serif, system-ui";
      ctx.fillText(text, p.x, p.y);
    }
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || tool !== "pen") return;
    const p = point(event);
    const ctx = ctx2d();
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const up = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    if (tool === "box") {
      const p = point(event);
      const ctx = ctx2d();
      ctx.strokeRect(
        start.current.x,
        start.current.y,
        p.x - start.current.x,
        p.y - start.current.y,
      );
    }
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = ctx2d();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  const tools: { key: Tool; icon: typeof PenLine; label: string }[] = [
    { key: "pen", icon: PenLine, label: "Draw" },
    { key: "box", icon: Square, label: "Box" },
    { key: "label", icon: Type, label: "Label" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-surface-raised p-1">
          {tools.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTool(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tool === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            <Eraser className="size-3.5" />
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!dirty || busy}
            onClick={() => onGenerate(canvasRef.current!.toDataURL("image/png"))}
          >
            <Sparkle className="size-3.5" />
            Generate website from sketch
          </Button>
        </div>
      </div>
      <div className="relative flex-1 bg-surface-raised p-4">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="h-full w-full cursor-crosshair rounded-xl border border-border bg-white"
        />
      </div>
    </div>
  );
}
