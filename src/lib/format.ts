import { languageOf } from "@/lib/files";

type Parser = "html" | "css" | "babel" | "json";

function parserFor(path: string): Parser | null {
  const lang = languageOf(path);
  if (lang === "html") return "html";
  if (lang === "css") return "css";
  if (lang === "json") return "json";
  if (lang === "js" || lang === "javascript" || lang === "ts" || lang === "typescript")
    return "babel";
  return null;
}

export function isFormattable(path: string) {
  return parserFor(path) !== null;
}

/** Format generated code in the browser with Prettier's standalone build. */
export async function formatCode(path: string, source: string) {
  const parser = parserFor(path);
  if (!parser) return source;

  const [{ format }, html, postcss, babel, estree] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
  ]);

  return await format(source, {
    parser,
    plugins: [
      html.default ?? html,
      postcss.default ?? postcss,
      babel.default ?? babel,
      estree.default ?? estree,
    ],
    printWidth: 100,
    tabWidth: 2,
    semi: true,
    singleQuote: false,
  });
}

/** Format every file that Prettier understands; unknown files pass through untouched. */
export async function formatAll<T extends { path: string; content: string }>(files: T[]) {
  return await Promise.all(
    files.map(async (file) => {
      try {
        return { ...file, content: await formatCode(file.path, file.content) };
      } catch {
        return file;
      }
    }),
  );
}
