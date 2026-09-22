import type { Mode } from "@/lib/prompts";

/**
 * Local, zero-cost intent detection. Runs in the browser before the request is
 * sent, so deciding between Chat / Plan / Build never spends an extra AI call.
 */

const PLAN_PATTERNS = [
  /\bplan\b/i,
  /\bplanning\b/i,
  /\broadmap\b/i,
  /\bchecklist\b/i,
  /\bstrategy\b/i,
  /\boutline\b/i,
  /\bsitemap\b/i,
  /\barchitecture\b/i,
  /\bstructure (of|for) (the |a |my )?(site|website|app)\b/i,
  /\bstep by step\b/i,
  /\bbefore (we|you) (build|start|code)\b/i,
  /\bmansuba\b/i,
];

const BUILD_PATTERNS = [
  /\b(build|create|make|generate|design|code|develop|scaffold|produce)\b/i,
  /\b(website|webpage|landing page|portfolio|dashboard|store|shop|blog|page|site)\b.*\b(for|about|with|of)\b/i,
  /\bredesign\b/i,
  /\brebuild\b/i,
  /\bclone\b/i,
  /\brecreate\b/i,
  /\b(bana|banao|banado|bana do|banadu|banaye|likho|likh do|kar do|kardo)\b/i,
  /\bchahiye\b/i,
];

const EDIT_PATTERNS = [
  /\b(change|update|edit|replace|remove|delete|add|insert|move|swap|fix|tweak|adjust|rename|resize|restyle|improve|polish)\b/i,
  /\b(color|colour|font|button|header|footer|hero|navbar|section|image|background|spacing|padding|margin|layout|dark mode|responsive)\b/i,
  /\b(badlo|badal|hata|hatao|thora|thoda|zyada|chhota|bara)\b/i,
];

const CHAT_PATTERNS = [
  /^(hi|hey|hello|yo|salam|assalam|aoa|thanks|thank you|shukriya|ok|okay|nice|great|cool)\b/i,
  /\b(what|why|how|which|who|when|should i|can you explain|explain|difference|compare|advice|suggest|recommend|opinion|idea|ideas|think)\b/i,
  /\b(kya|kaise|kyun|kyu|batao|samjhao|behtar|acha hai)\b/i,
  /\?\s*$/,
];

function matches(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectMode(
  text: string,
  context?: { hasImage?: boolean; hasFiles?: boolean },
): Mode {
  const value = text.trim();

  // A design reference or sketch is always a build request.
  if (context?.hasImage) return "build";
  if (!value) return "chat";

  const wantsPlan = matches(PLAN_PATTERNS, value);
  const wantsBuild = matches(BUILD_PATTERNS, value);
  const soundsLikeChat = matches(CHAT_PATTERNS, value);

  // "plan a site" wins over "build" when both are mentioned.
  if (wantsPlan && !/\bnow build\b/i.test(value)) return "plan";
  if (wantsBuild) return "build";

  // Follow-up edits once a site exists ("make the header sticky").
  if (context?.hasFiles && matches(EDIT_PATTERNS, value) && !soundsLikeChat) return "build";

  if (soundsLikeChat) return "chat";

  // Long, descriptive briefs without a question read as build requests.
  if (!context?.hasFiles && value.split(/\s+/).length > 18) return "build";

  return "chat";
}

export const MODE_LABEL: Record<Mode, string> = {
  chat: "Chat",
  plan: "Plan",
  build: "Builder",
};

const RESEARCH_PATTERNS = [
  /https?:\/\//i,
  /\b(competitor|competitors|market|trend|trends|latest|news|pricing of|research|inspired by|like (airbnb|stripe|apple|notion|linear|vercel)|benchmark|statistics|stats)\b/i,
  /\b(similar to|jaisa|jaisi)\b/i,
];

/** Turn live web search on by itself when the request clearly needs fresh facts. */
export function detectResearch(text: string): boolean {
  return RESEARCH_PATTERNS.some((pattern) => pattern.test(text));
}
