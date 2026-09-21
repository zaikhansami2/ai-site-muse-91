/** Browser-side capture helpers: site thumbnails, OG cards and showcase videos. */

const ACCENT = "#2fe0c0";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The capture could not be loaded."));
    image.src = src;
  });
}

/** Render the generated site off-screen and screenshot it with html2canvas. */
export async function captureThumbnail(html: string, width = 1280, height = 800) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;border:0;width:${width}px;height:${height}px;`;
  frame.srcdoc = html;
  document.body.appendChild(frame);

  try {
    await new Promise<void>((resolve) => {
      frame.addEventListener("load", () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });
    // Give webfonts, images and entry animations a moment to settle.
    await new Promise((resolve) => setTimeout(resolve, 900));

    const doc = frame.contentDocument;
    if (!doc?.body) throw new Error("The preview could not be captured.");

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(doc.body, {
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scale: 1,
    });

    const out = document.createElement("canvas");
    out.width = 960;
    out.height = Math.round((960 / width) * height);
    out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.85);
  } finally {
    frame.remove();
  }
}

/** Compose a 1200x630 OpenGraph card from the thumbnail. */
export async function composeOgCard(thumbnail: string, title: string, subtitle: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d")!;
  const shot = await loadImage(thumbnail);

  ctx.fillStyle = "#0d1113";
  ctx.fillRect(0, 0, 1200, 630);

  const scale = Math.max(1200 / shot.width, 630 / shot.height);
  const w = shot.width * scale;
  const h = shot.height * scale;
  ctx.drawImage(shot, (1200 - w) / 2, 0, w, h);

  const gradient = ctx.createLinearGradient(0, 200, 0, 630);
  gradient.addColorStop(0, "rgba(9,13,15,0)");
  gradient.addColorStop(1, "rgba(9,13,15,0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(64, 500, 56, 5);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 58px system-ui, sans-serif";
  ctx.fillText(title.slice(0, 34), 64, 566);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "400 26px system-ui, sans-serif";
  ctx.fillText(subtitle.slice(0, 60), 64, 602);

  return canvas.toDataURL("image/png");
}

/**
 * Animate the captured site into a short marketing clip (slow zoom + title
 * reveal) and record it straight from the canvas as a WebM video.
 */
export async function recordShowcase(
  thumbnail: string,
  title: string,
  subtitle: string,
  durationMs = 7000,
  onProgress?: (ratio: number) => void,
) {
  const shot = await loadImage(thumbnail);
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  if (!mimeType) throw new Error("This browser cannot record video.");

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  recorder.start();

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      onProgress?.(t);

      ctx.fillStyle = "#0d1113";
      ctx.fillRect(0, 0, 1280, 720);

      // Slow ken-burns push on the screenshot.
      const zoom = 1.06 + 0.12 * easeOut(t);
      const ratio = Math.max(1280 / shot.width, 720 / shot.height) * zoom;
      const w = shot.width * ratio;
      const h = shot.height * ratio;
      ctx.globalAlpha = Math.min(t / 0.12, 1);
      ctx.drawImage(shot, (1280 - w) / 2, (720 - h) / 2 - 20 * t, w, h);
      ctx.globalAlpha = 1;

      // Title card fades in over the lower third.
      const intro = Math.min(Math.max((t - 0.25) / 0.25, 0), 1);
      if (intro > 0) {
        const gradient = ctx.createLinearGradient(0, 300, 0, 720);
        gradient.addColorStop(0, "rgba(9,13,15,0)");
        gradient.addColorStop(1, `rgba(9,13,15,${0.94 * intro})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1280, 720);

        const slide = (1 - easeOut(intro)) * 40;
        ctx.globalAlpha = intro;
        ctx.fillStyle = ACCENT;
        ctx.fillRect(88, 556 + slide, 40 + 120 * easeOut(intro), 5);
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 62px system-ui, sans-serif";
        ctx.fillText(title.slice(0, 32), 88, 630 + slide);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "400 28px system-ui, sans-serif";
        ctx.fillText(subtitle.slice(0, 58), 88, 670 + slide);
        ctx.globalAlpha = 1;
      }

      // Gentle fade to black at the very end.
      const outro = Math.max((t - 0.92) / 0.08, 0);
      if (outro > 0) {
        ctx.fillStyle = `rgba(9,13,15,${outro})`;
        ctx.fillRect(0, 0, 1280, 720);
      }

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  return await finished;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
