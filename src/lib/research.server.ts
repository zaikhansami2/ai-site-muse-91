const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type SearchResult = { title: string; url: string; snippet: string };

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function parseDuckDuckGo(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const blocks = html.split("result__body").slice(1);
  for (const block of blocks) {
    const link = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    let url = decodeEntities(link[1]!);
    const redirect = /[?&]uddg=([^&]+)/.exec(url);
    if (redirect) url = decodeURIComponent(redirect[1]!);
    if (url.startsWith("//")) url = `https:${url}`;
    if (!url.startsWith("http") || /duckduckgo\.com\/(y|l)\.js/.test(url)) continue;
    const snippet = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    results.push({
      title: stripTags(link[2]!),
      url,
      snippet: snippet ? stripTags(snippet[1]!).slice(0, 400) : "",
    });
    if (results.length >= limit) break;
  }
  return results;
}

function parseLite(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const rows = Array.from(html.matchAll(/<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));
  const snippets = Array.from(html.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi));
  rows.forEach((row, index) => {
    if (results.length >= limit) return;
    let url = decodeEntities(row[1]!);
    const redirect = /[?&]uddg=([^&]+)/.exec(url);
    if (redirect) url = decodeURIComponent(redirect[1]!);
    if (url.startsWith("//")) url = `https:${url}`;
    if (!url.startsWith("http") || /duckduckgo\.com\/(y|l)\.js/.test(url)) return;
    results.push({
      title: stripTags(row[2]!),
      url,
      snippet: snippets[index] ? stripTags(snippets[index]![1]!).slice(0, 400) : "",
    });
  });
  return results;
}

/** Live DuckDuckGo results, scraped from the no-JS endpoints (no API key needed). */
export async function searchWeb(query: string, limit = 5): Promise<SearchResult[]> {
  const attempts: { url: string; parse: (html: string, limit: number) => SearchResult[] }[] = [
    { url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, parse: parseDuckDuckGo },
    { url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, parse: parseLite },
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!response.ok) continue;
      const results = attempt.parse(await response.text(), limit);
      if (results.length > 0) return results;
    } catch {
      /* try the next endpoint */
    }
  }
  return [];
}

/** Fetch a page and reduce it to readable text a model can work with. */
export async function extractPage(url: string, maxChars = 4000) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return null;

    const html = await response.text();
    const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
    const description =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ?? "";

    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

    const headings = Array.from(body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
      .map((match) => stripTags(match[1]!))
      .filter(Boolean)
      .slice(0, 25);

    return {
      url,
      title,
      description: decodeEntities(description),
      headings,
      text: stripTags(body).slice(0, maxChars),
    };
  } catch {
    return null;
  }
}

/** Search, read the top pages, and format everything as context for the model. */
export async function researchContext(query: string) {
  const results = await searchWeb(query, 5);
  if (results.length === 0) return "";

  const pages = await Promise.all(results.slice(0, 2).map((result) => extractPage(result.url, 2500)));

  const lines = [
    "LIVE WEB RESEARCH (fetched just now — use it for facts, naming, and design cues):",
    "",
    "Search results:",
    ...results.map((result, index) => `${index + 1}. ${result.title} — ${result.url}\n   ${result.snippet}`),
  ];

  for (const page of pages) {
    if (!page) continue;
    lines.push(
      "",
      `Page content — ${page.title || page.url} (${page.url}):`,
      page.description ? `Description: ${page.description}` : "",
      page.headings.length > 0 ? `Sections: ${page.headings.join(" · ")}` : "",
      page.text.slice(0, 2000),
    );
  }

  return lines.filter(Boolean).join("\n");
}
