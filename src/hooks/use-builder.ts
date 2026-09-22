import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyAssets,
  maskAssets,
  parseFiles,
  stripFiles,
  type Asset,
  type ProjectFile,
} from "@/lib/files";
import { parseDocs, type DocSpec } from "@/lib/docs";
import { detectAssetIntent, detectMode, detectResearch } from "@/lib/intent";
import type { Mode } from "@/lib/prompts";
import {
  loadProjects,
  newProject,
  saveProjects,
  type ChatMessage,
  type Project,
} from "@/lib/storage";

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

  // Switching chats reopens the workspace only when that chat already has a site.
  useEffect(() => {
    setBuilderOpen((projects.find((p) => p.id === activeId)?.files.length ?? 0) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const hasFilesRef = useRef(false);
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    hasFilesRef.current = (active?.files?.length ?? 0) > 0;
    projectsRef.current = projects;
  }, [active, projects]);

  const mergeDocs = (current: DocSpec[], incoming: DocSpec[]): DocSpec[] => {
    const next = [...current];
    for (const doc of incoming) {
      const index = next.findIndex((item) => item.id === doc.id);
      if (index >= 0) next[index] = doc;
      else next.push(doc);
    }
    return next;
  };

  const mergeFiles = (current: ProjectFile[], incoming: ProjectFile[]): ProjectFile[] => {
    if (incoming.length === 0) return current;
    const next = [...current];
    for (const file of incoming) {
      const index = next.findIndex((item) => item.path === file.path);
      if (index >= 0) next[index] = file;
      else next.push(file);
    }
    return next;
  };

  const send = useCallback(
    async (text: string, options?: { image?: string; imageName?: string; mode?: Mode }) => {
      const requestMode: Mode =
        options?.mode ??
        (mode === "auto"
          ? detectMode(text, { hasImage: Boolean(options?.image), hasFiles: hasFilesRef.current })
          : mode);
      if (!text.trim() && !options?.image) return;
      setError(null);
      setLastMode(requestMode);
      if (requestMode === "build") setBuilderOpen(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        mode: requestMode,
        ...(options?.image ? { image: options.image } : {}),
      };
      const assistantId = crypto.randomUUID();

      const current = projectsRef.current.find((p) => p.id === activeIdRef.current);
      const baseFiles: ProjectFile[] = current?.files ?? [];
      const history: ChatMessage[] = [...(current?.messages ?? []), userMessage];

      // An attached image is either a design reference or real content to place
      // inside the site (a logo, a photo). When it is content, it becomes an
      // asset with a token the model can position exactly where the user asked.
      const existingAssets: Asset[] = current?.assets ?? [];
      const placeImage =
        requestMode === "build" &&
        Boolean(options?.image) &&
        detectAssetIntent(text, { hasFiles: baseFiles.length > 0 });
      const newAsset: Asset | null = placeImage
        ? {
            token: `__ASSET_${existingAssets.length + 1}__`,
            name: options?.imageName ?? `upload-${existingAssets.length + 1}`,
            url: options!.image!,
          }
        : null;
      const assets: Asset[] = newAsset ? [...existingAssets, newAsset] : existingAssets;

      patchActive((project) => {
        return {
          ...project,
          name:
            project.messages.length === 0 && text.trim() ? text.trim().slice(0, 48) : project.name,
          ...(newAsset ? { assets } : {}),
          messages: [
            ...project.messages,
            userMessage,
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
            research: research || detectResearch(text),
            ...(requestMode === "build" && baseFiles.length > 0
              ? { files: maskAssets(baseFiles, assets) }
              : {}),
            ...(assets.length > 0
              ? { assets: assets.map(({ token, name }) => ({ token, name })) }
              : {}),
            messages: history.map((m) => ({
              role: m.role,
              // Past build replies are stored with full code; send the summary only
              // so the model keeps the conversation in memory without huge payloads.
              content: m.role === "assistant" ? stripFiles(m.content) : m.content,
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
          const parsed = requestMode === "build" ? applyAssets(parseFiles(snapshot), assets) : null;
          const docs = requestMode === "build" ? parseDocs(snapshot) : [];
          patchActive((project) => ({
            ...project,
            messages: project.messages.map((m) =>
              m.id === assistantId ? { ...m, content: snapshot } : m,
            ),
            files:
              parsed && parsed.length > 0
                ? mergeFiles(baseFiles, parsed as ProjectFile[])
                : project.files,
            docs: docs.length > 0 ? mergeDocs(project.docs ?? [], docs) : project.docs,
          }));
        }

        // Tidy the generated code with Prettier before it lands in the editor.
        if (requestMode === "build") {
          setStatus("formatting");
          const finalFiles = applyAssets(parseFiles(acc), assets);
          if (finalFiles.length > 0) {
            const { formatAll } = await import("@/lib/format");
            const pretty = await formatAll(mergeFiles(baseFiles, finalFiles as ProjectFile[]));
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
    lastMode,
    builderOpen,
    setBuilderOpen,
    research,
    setResearch,
    status,
    error,
    send,
    stop,
    hydrated,
  };
}
