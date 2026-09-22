export type ProjectFile = { path: string; content: string };

const FILE_OPEN = /<file path="([^"]+)">/g;

/**
 * Parses <file path="..."> blocks out of a (possibly still streaming) model
 * response. The final unterminated block is returned too, so the code view can
 * render files as they arrive.
 */
export function parseFiles(text: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  FILE_OPEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FILE_OPEN.exec(text)) !== null) {
    const path = (match[1] ?? "").replace(/^\.?\//, "").trim();
    const start = match.index + match[0].length;
    const end = text.indexOf("</file>", start);
    const content = (end === -1 ? text.slice(start) : text.slice(start, end)).replace(/^\n/, "");
    if (!path) continue;
    const existing = files.findIndex((f) => f.path === path);
    if (existing >= 0) files[existing] = { path, content };
    else files.push({ path, content });
  }

  return files;
}

/** Strips file blocks so the chat bubble only shows prose. */
export function stripFiles(text: string): string {
  return text
    .replace(/<file path="[^"]*">[\s\S]*?(<\/file>|$)/g, "")
    .replace(/<clarify>[\s\S]*?(<\/clarify>|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type Clarify = { question: string; options: string[] };

/**
 * The model asks at most one question by emitting a <clarify> block. The chat
 * renders it as a choice card instead of plain text.
 */
export function parseClarify(text: string): Clarify | null {
  const match = /<clarify>([\s\S]*?)<\/clarify>/.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse((match[1] ?? "").trim()) as Partial<Clarify>;
    if (!parsed.question) return null;
    return {
      question: String(parsed.question),
      options: Array.isArray(parsed.options) ? parsed.options.map(String).slice(0, 4) : [],
    };
  } catch {
    return null;
  }
}

export type Asset = { token: string; name: string; url: string };

/** Swaps __ASSET_n__ tokens for the real uploaded image data. */
export function applyAssets(files: ProjectFile[], assets: Asset[]): ProjectFile[] {
  if (assets.length === 0) return files;
  return files.map((file) => {
    let content = file.content;
    for (const asset of assets) content = content.split(asset.token).join(asset.url);
    return { ...file, content };
  });
}

/** Reverse of applyAssets — keeps huge data URLs out of the model's context. */
export function maskAssets(files: ProjectFile[], assets: Asset[]): ProjectFile[] {
  if (assets.length === 0) return files;
  return files.map((file) => {
    let content = file.content;
    for (const asset of assets) content = content.split(asset.url).join(asset.token);
    return { ...file, content };
  });
}

export function languageOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "javascript";
  if (ext === "json") return "json";
  if (ext === "md") return "markdown";
  return "text";
}

/** Inlines css/js siblings into index.html so it can run inside a sandboxed iframe. */
export function buildPreviewDocument(files: ProjectFile[]): string {
  const index = files.find((f) => /(^|\/)index\.html$/.test(f.path)) ?? files[0];
  if (!index) return "";
  let html = index.content;

  for (const file of files) {
    if (file.path.endsWith(".css")) {
      const name = file.path.split("/").pop()!;
      const link = new RegExp(`<link[^>]*href=["'][^"']*${escapeRe(name)}["'][^>]*>`, "gi");
      html = html.replace(link, `<style>\n${file.content}\n</style>`);
    }
    if (file.path.endsWith(".js")) {
      const name = file.path.split("/").pop()!;
      const script = new RegExp(
        `<script[^>]*src=["'][^"']*${escapeRe(name)}["'][^>]*>\\s*</script>`,
        "gi",
      );
      html = html.replace(script, `<script>\n${file.content}\n</script>`);
    }
  }

  return html;
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
