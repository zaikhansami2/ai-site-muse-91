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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
      const link = new RegExp(
        `<link[^>]*href=["'][^"']*${escapeRe(name)}["'][^>]*>`,
        "gi",
      );
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
