import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseFiles, type ProjectFile } from "@/lib/files";
import { detectMode } from "@/lib/intent";
import type { Mode } from "@/lib/prompts";
import { loadProjects, newProject, saveProjects, type ChatMessage, type Project } from "@/lib/storage";

export type Status = "idle" | "analyzing" | "building" | "formatting" | "error";

/** "auto" lets the assistant decide between chat, plan and build by itself. */
export type UiMode = Mode | "auto";

export function useBuilder() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<UiMode>("auto");
  const [lastMode, setLastMode] = useState<Mode>("chat");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [research, setResearch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = loadProjects();
    const list = stored.length > 0 ? stored : [newProject()];
    setProjects(list);
    setActiveId(list[0]!.id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveProjects(projects);
  }, [projects, hydrated]);

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );

  // activeId lives in a ref so patchActive never nests a setState inside another
  // updater — React would replay that updater and duplicate appended messages.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const patchActive = useCallback((patch: (project: Project) => Project) => {
    const id = activeIdRef.current;
    if (!id) return;
    setProjects((list) =>
      list.map((project) =>
        project.id === id ? { ...patch(project), updatedAt: Date.now() } : project,
      ),
    );
  }, []);

  const createProject = useCallback(() => {
    const project = newProject();
    setProjects((list) => [project, ...list]);
    setActiveId(project.id);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((list) => {
      const next = list.filter((p) => p.id !== id);
      const fallback = next.length > 0 ? next : [newProject()];
      setActiveId((current) => (current === id ? fallback[0]!.id : current));
      return fallback;
    });
  }, []);

  const renameProject = useCallback(
    (name: string) => patchActive((project) => ({ ...project, name })),
    [patchActive],
  );

  const setFiles = useCallback(
    (files: ProjectFile[]) => patchActive((project) => ({ ...project, files })),
    [patchActive],
  );

  const setThumbnail = useCallback(
    (thumbnail: string) => patchActive((project) => ({ ...project, thumbnail })),
    [patchActive],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (text: string, options?: { image?: string; mode?: Mode }) => {
      const requestMode = options?.mode ?? mode;
      if (!text.trim() && !options?.image) return;
      setError(null);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        mode: requestMode,
        ...(options?.image ? { image: options.image } : {}),
      };
      const assistantId = crypto.randomUUID();

      let history: ChatMessage[] = [];
      patchActive((project) => {
        history = [...project.messages, userMessage];
        return {
          ...project,
          name:
            project.messages.length === 0 && text.trim()
              ? text.trim().slice(0, 48)
              : project.name,
          messages: [
            ...history,
            { id: assistantId, role: "assistant", content: "", mode: requestMode },
          ],
        };
      });

      setStatus("analyzing");
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: requestMode,
            research,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
              ...(m.image ? { image: m.image } : {}),
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error((await response.text()) || "The AI request failed.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });

          if (requestMode === "build") {
            setStatus(acc.includes("<file path=") ? "building" : "analyzing");
          } else {
            setStatus("building");
          }

          const snapshot = acc;
          const parsed = requestMode === "build" ? parseFiles(snapshot) : null;
          patchActive((project) => ({
            ...project,
            messages: project.messages.map((m) =>
              m.id === assistantId ? { ...m, content: snapshot } : m,
            ),
            files: parsed && parsed.length > 0 ? (parsed as ProjectFile[]) : project.files,
          }));
        }

        // Tidy the generated code with Prettier before it lands in the editor.
        if (requestMode === "build") {
          setStatus("formatting");
          const finalFiles = parseFiles(acc);
          if (finalFiles.length > 0) {
            const { formatAll } = await import("@/lib/format");
            const pretty = await formatAll(finalFiles as ProjectFile[]);
            patchActive((project) => ({ ...project, files: pretty }));
          }
        }
        setStatus("idle");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        abortRef.current = null;
      }
    },
    [mode, patchActive, research],
  );

  return {
    projects,
    active,
    activeId,
    setActiveId,
    createProject,
    deleteProject,
    renameProject,
    setFiles,
    setThumbnail,
    mode,
    setMode,
    research,
    setResearch,
    status,
    error,
    send,
    stop,
    hydrated,
  };
}
