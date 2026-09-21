import type { ProjectFile } from "./files";
import type { Mode } from "./prompts";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: Mode;
  image?: string;
};

export type Project = {
  id: string;
  name: string;
  updatedAt: number;
  messages: ChatMessage[];
  files: ProjectFile[];
};

const KEY = "forgeui.projects.v1";

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects.slice(0, 40)));
  } catch {
    /* quota exceeded — keep the session alive */
  }
}

export function newProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "Untitled site",
    updatedAt: Date.now(),
    messages: [],
    files: [],
  };
}
