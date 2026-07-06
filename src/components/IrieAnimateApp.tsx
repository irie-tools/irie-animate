"use client";

import {
  Activity,
  BarChart3,
  Box,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Database,
  Expand,
  FileCode2,
  Film,
  Folder,
  Gauge,
  Image as ImageIcon,
  LayoutPanelLeft,
  Maximize2,
  Monitor,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  RotateCw,
  Settings,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Type,
  Upload,
  Waves
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import brandConfig from "../../brands/irie-demo.json";
import type { EditorProject, TimelineTrack } from "../lib/projectStore";
import type { BrandConfig, FramesManifest, SceneManifest } from "../lib/types";
import styles from "./IrieAnimateApp.module.css";

const brand = brandConfig as BrandConfig;

const sideTabs = [
  { id: "brand", label: "Brand", Icon: LayoutPanelLeft },
  { id: "scenes", label: "Scenes", Icon: Film },
  { id: "assets", label: "Assets", Icon: Box },
  { id: "settings", label: "Settings", Icon: Settings }
];

const railTools = [
  { id: "layout", label: "Layout", Icon: LayoutPanelLeft },
  { id: "timeline", label: "Timeline", Icon: Film },
  { id: "code", label: "Code", Icon: Code2 },
  { id: "analytics", label: "Analytics", Icon: BarChart3 }
];

const trackIcons = {
  camera: ImageIcon,
  box: Box,
  type: Type,
  sun: Sun,
  waves: Waves,
  sparkles: Sparkles
};

type RightTab = "pipeline" | "inspect" | "data" | "code";
type RailMode = "layout" | "timeline" | "code" | "analytics";
type TimelineView = "timeline" | "curve";

export function IrieAnimateApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadPurposeRef = useRef<"reference" | "logo">("reference");
  const drawSampleAt = useRef(0);
  const loadedFrames = useRef<Map<string, Array<HTMLImageElement | undefined>>>(new Map());
  const [project, setProject] = useState<EditorProject | null>(null);
  const [manifest, setManifest] = useState<FramesManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState("hero");
  const [activeRailMode, setActiveRailMode] = useState<RailMode>("layout");
  const [activeSideTab, setActiveSideTab] = useState("brand");
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("pipeline");
  const [timelineView, setTimelineView] = useState<TimelineView>("timeline");
  const [scrub, setScrub] = useState(0);
  const [zoom, setZoom] = useState(63);
  const [canvasWidth, setCanvasWidth] = useState(1440);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawMs, setDrawMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [frameLoadProgress, setFrameLoadProgress] = useState(0);
  const [frameLoadVersion, setFrameLoadVersion] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceCount, setReferenceCount] = useState(0);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState("camera-push");
  const [undoStack, setUndoStack] = useState<EditorProject[]>([]);
  const [redoStack, setRedoStack] = useState<EditorProject[]>([]);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch("/api/projects/irie-demo", {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Could not load local project state.");
      }
      const payload = await response.json();
      setProject(payload.project as EditorProject);
      setManifest(payload.manifest as FramesManifest | null);
      setManifestError(null);
      setActiveSceneId(payload.project?.activeSceneId || payload.manifest?.scenes?.[0]?.id || "hero");
    } catch (error) {
      setManifestError(error instanceof Error ? error.message : "Project failed to load.");
    }
  }, []);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const saveProject = useCallback(async (patch: Partial<EditorProject>, options: { recordHistory?: boolean } = {}) => {
    if (project && options.recordHistory !== false) {
      setUndoStack((stack) => [...stack.slice(-24), project]);
      setRedoStack([]);
    }
    const response = await fetch("/api/projects/irie-demo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setToast(payload.error || "Project save failed.");
      return null;
    }
    setProject(payload.project as EditorProject);
    setToast("Project saved.");
    return payload.project as EditorProject;
  }, [project]);

  const restoreProject = useCallback(async (snapshot: EditorProject) => {
    const response = await fetch("/api/projects/irie-demo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setToast(payload.error || "Restore failed.");
      return null;
    }
    setProject(payload.project as EditorProject);
    setActiveSceneId(payload.project.activeSceneId);
    setToast("Project restored.");
    return payload.project as EditorProject;
  }, []);

  const undoProject = useCallback(async () => {
    if (!project || !undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-24), project]);
    await restoreProject(previous);
  }, [project, restoreProject, undoStack]);

  const redoProject = useCallback(async () => {
    if (!project || !redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-24), project]);
    await restoreProject(next);
  }, [project, redoStack, restoreProject]);

  const currentEditorScene = useMemo(() => {
    return project?.scenes.find((scene) => scene.frameSceneId === activeSceneId || scene.id === activeSceneId) ?? project?.scenes[0] ?? null;
  }, [activeSceneId, project]);

  const activeScene = useMemo(() => {
    return manifest?.scenes.find((scene) => scene.id === activeSceneId) ?? manifest?.scenes[0] ?? null;
  }, [activeSceneId, manifest]);

  const selectedClip = useMemo(() => {
    return project?.timeline.flatMap((track) => track.clips.map((clip) => ({ ...clip, trackId: track.id }))).find((clip) => clip.id === selectedClipId) ?? null;
  }, [project, selectedClipId]);

  const logoAsset = useMemo(() => {
    return project?.assets.find((asset) => asset.id === project.brand.logoAssetId) ?? null;
  }, [project]);

  useEffect(() => {
    if (!activeScene) return;
    let cancelled = false;
    const cacheKey = `${activeScene.id}:${isMobilePreview ? "mobile" : "desktop"}`;

    async function loadFrames(scene: SceneManifest) {
      if (loadedFrames.current.has(cacheKey)) {
        setFrameLoadProgress(1);
        return;
      }

      const nextFrames: Array<HTMLImageElement | undefined> = Array.from({ length: scene.frameCount });
      const folder = isMobilePreview ? "mobile" : "desktop";
      loadedFrames.current.set(cacheKey, nextFrames);

      let completed = 0;
      for (let i = 1; i <= scene.frameCount; i += 1) {
        if (cancelled) return;
        const frameIndex = i - 1;
        const image = new Image();
        image.decoding = "async";
        image.src = `/frames/${brand.id}/${scene.id}/${folder}/frame-${String(i).padStart(4, "0")}.webp`;
        image.onload = () => {
          nextFrames[frameIndex] = image;
          completed += 1;
          setFrameLoadProgress(completed / scene.frameCount);
          if (frameIndex === 0 || frameIndex % 8 === 0 || completed === scene.frameCount) {
            setFrameLoadVersion((version) => version + 1);
          }
        };
        image.onerror = () => {
          completed += 1;
          setFrameLoadProgress(completed / scene.frameCount);
        };
      }
    }

    setFrameLoadProgress(0);
    loadFrames(activeScene);
    return () => {
      cancelled = true;
    };
  }, [activeScene, isMobilePreview]);

  const drawFrame = useCallback(() => {
    const startedAt = performance.now();
    const scene = activeScene;
    const canvas = canvasRef.current;
    if (!scene || !canvas) return;

    const cacheKey = `${scene.id}:${isMobilePreview ? "mobile" : "desktop"}`;
    const frames = loadedFrames.current.get(cacheKey);
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#050505";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (!frames?.length) {
      context.fillStyle = "rgba(238, 232, 220, 0.78)";
      context.font = `${15 * dpr}px Inter, sans-serif`;
      context.fillText("Loading frame sequence...", 28 * dpr, 42 * dpr);
      return;
    }

    const frameIndex = Math.min(frames.length - 1, Math.max(0, Math.round(scrub * (frames.length - 1))));
    const image = frames[frameIndex] ?? findNearestFrame(frames, frameIndex);
    if (!image) {
      context.fillStyle = "rgba(238, 232, 220, 0.78)";
      context.font = `${15 * dpr}px Inter, sans-serif`;
      context.fillText("Loading frame sequence...", 28 * dpr, 42 * dpr);
      return;
    }
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const x = (canvas.width - imageWidth) / 2;
    const y = (canvas.height - imageHeight) / 2;
    context.drawImage(image, x, y, imageWidth, imageHeight);
    const now = performance.now();
    if (now - drawSampleAt.current > 300) {
      drawSampleAt.current = now;
      setDrawMs(Number((now - startedAt).toFixed(2)));
    }
  }, [activeScene, frameLoadVersion, isMobilePreview, scrub]);

  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame = 0;
    let previous = performance.now();

    function tick(now: number) {
      const delta = Math.min(64, now - previous);
      previous = now;
      setScrub((value) => (value + delta / 6500) % 1);
      animationFrame = requestAnimationFrame(tick);
    }

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);

  const runDemoPipeline = useCallback(async () => {
    setIsGenerating(true);
    setManifestError(null);
    setToast("Cooking frame sequence...");
    try {
      const response = await fetch("/api/pipeline/demo", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Pipeline failed.");
      }
      loadedFrames.current.clear();
      setManifest(payload.manifest as FramesManifest);
      setActiveSceneId(payload.manifest.scenes[0]?.id || "hero");
      setScrub(0);
      setFrameLoadProgress(0);
      setLastRunAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      setToast("Frame sequence rebuilt from bitmap reference.");
    } catch (error) {
      setManifestError(error instanceof Error ? error.message : "Pipeline failed.");
      setToast("Pipeline needs attention.");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const exportSite = useCallback(async () => {
    setToast("Exporting static package...");
    const response = await fetch("/api/export", { method: "POST" });
    const payload = await response.json();
    if (payload.ok) {
      setToast(`Export ready: ${payload.outputDir}`);
    } else {
      setToast(payload.error || "Export failed.");
    }
  }, []);

  const publishPreview = useCallback(async () => {
    setToast("Preparing publish fallback...");
    const response = await fetch("/api/publish", { method: "POST" });
    const payload = await response.json();
    if (payload.ok) {
      setPublishResult(payload.message);
      setToast(payload.message);
    } else {
      setToast(payload.error || "Publish failed.");
    }
  }, []);

  const sharePreview = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "http://localhost:3000";
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setToast("Preview URL copied.");
  }, []);

  const uploadReferenceFiles = useCallback(async (files: FileList | null, purpose: "reference" | "logo" = "reference") => {
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    formData.append("purpose", purpose);
    setReferenceCount(files.length);
    setToast("Uploading reference assets...");
    const response = await fetch("/api/projects/irie-demo/assets", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setToast(payload.error || "Asset upload failed.");
      return;
    }
    setProject(payload.project as EditorProject);
    setToast(purpose === "logo" ? "Logo asset saved and assigned." : `${payload.assets.length} asset(s) saved locally.`);
  }, []);

  const activateRailMode = useCallback((mode: RailMode) => {
    setActiveRailMode(mode);
    setHelpOpen(false);
    if (mode === "layout") {
      setActiveSideTab("brand");
      setLeftCollapsed(false);
    } else if (mode === "timeline") {
      setTimelineView("timeline");
      setLeftCollapsed(false);
    } else if (mode === "code") {
      setActiveRightTab("code");
    } else {
      setActiveRightTab("pipeline");
    }
  }, []);

  const updateBrand = useCallback((patch: Partial<EditorProject["brand"]>) => {
    if (!project) return;
    const nextBrand = { ...project.brand, ...patch };
    setProject({ ...project, brand: nextBrand });
    void saveProject({ brand: nextBrand });
  }, [project, saveProject]);

  const updateColor = useCallback((index: number, hex: string) => {
    if (!project) return;
    const colors = project.brand.colors.map((color, colorIndex) => colorIndex === index ? { ...color, hex } : color);
    updateBrand({ colors });
  }, [project, updateBrand]);

  const selectEditorScene = useCallback((sceneId: string) => {
    if (!project) return;
    const scene = project.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    setActiveSceneId(scene.frameSceneId);
    setScrub(0);
    void saveProject({ activeSceneId: scene.frameSceneId });
  }, [project, saveProject]);

  const updateSceneName = useCallback((sceneId: string, name: string) => {
    if (!project) return;
    const scenes = project.scenes.map((scene) => scene.id === sceneId ? { ...scene, name } : scene);
    setProject({ ...project, scenes });
    void saveProject({ scenes });
  }, [project, saveProject]);

  const addScene = useCallback(() => {
    if (!project) return;
    const number = String(project.scenes.length + 1).padStart(2, "0");
    const scene = {
      id: `scene-${number}`,
      number,
      name: `Scene ${number}`,
      frameSceneId: manifest?.scenes[0]?.id || "hero",
      target: "hero"
    };
    const scenes = [...project.scenes, scene];
    setProject({ ...project, scenes });
    void saveProject({ scenes });
  }, [manifest, project, saveProject]);

  const updateSelectedClip = useCallback((patch: { text?: string; start?: number; width?: number }) => {
    if (!project || !selectedClip) return;
    const timeline = project.timeline.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== selectedClip.id) return clip;
        return {
          ...clip,
          text: patch.text ?? clip.text,
          start: patch.start === undefined ? clip.start : clampNumber(snapEnabled ? Math.round(patch.start / 5) * 5 : patch.start, 0, 98),
          width: patch.width === undefined ? clip.width : clampNumber(snapEnabled ? Math.round(patch.width / 5) * 5 : patch.width, 2, 100)
        };
      })
    }));
    setProject({ ...project, timeline });
    void saveProject({ timeline });
  }, [project, saveProject, selectedClip, snapEnabled]);

  const updateChecklistItem = useCallback((index: number, done: boolean) => {
    if (!project) return;
    const checklist = project.checklist.map((item, itemIndex) => itemIndex === index ? { ...item, done } : item);
    setProject({ ...project, checklist });
    void saveProject({ checklist });
  }, [project, saveProject]);

  const updateVital = useCallback((index: number, patch: Partial<EditorProject["vitals"][number]>) => {
    if (!project) return;
    const vitals = project.vitals.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    setProject({ ...project, vitals });
    void saveProject({ vitals });
  }, [project, saveProject]);

  const totalMb = manifest?.scenes.reduce((sum, scene) => sum + scene.totalMb, 0) ?? 0;
  const heroMb = manifest?.scenes.find((scene) => scene.target === "hero")?.totalMb ?? 0;
  const activeFrame = activeScene ? Math.round(scrub * Math.max(0, activeScene.frameCount - 1)) + 1 : 0;
  const currentSeconds = scrub * 6.5;
  const previewBaseWidth = isMobilePreview ? Math.min(430, canvasWidth) : canvasWidth;
  const previewWidth = Math.max(260, Math.round(previewBaseWidth * (zoom / 100)));
  const previewHeight = Math.round(previewWidth * 9 / 16);
  const scriptMs = Number(Math.max(drawMs, Math.min(10.8, 6.4 + totalMb * 0.38)).toFixed(1));
  const layoutMs = Number(Math.min(8.6, 4.8 + (manifest?.scenes.length ?? 0) * 0.42).toFixed(1));
  const paintMs = Number(Math.min(8.2, 3.9 + heroMb * 0.7).toFixed(1));
  const otherMs = Number(Math.max(3.1, 24.3 - scriptMs - layoutMs - paintMs).toFixed(1));
  const frameBudgetMs = Number((scriptMs + layoutMs + paintMs + otherMs).toFixed(1));
  const budgetRatio = Math.min(100, Math.round((frameBudgetMs / 33.3) * 100));
  const codeSnippet = `# Build from the live local project state\ncurl -X POST http://localhost:3000/api/pipeline/demo\ncurl -X POST http://localhost:3000/api/export\n\n# CLI fallback still exists for static brand JSON\nnpm run pipeline -- --brand ${project?.brandId ?? brand.id}\n# frames -> public/frames/${project?.brandId ?? brand.id}/`;
  const completedChecklist = project?.checklist.filter((item) => item.done).length ?? 0;
  const pipelineSteps = [
    { label: "Ingest", done: Boolean(project) },
    { label: "Process", done: Boolean(manifest) },
    { label: "Animate", done: Boolean(manifest?.scenes.length) },
    { label: "Build", done: totalMb > 0 },
    { label: "Ready", done: Boolean(manifest && completedChecklist >= (project?.checklist.length ?? 1) - 1) }
  ];

  return (
    <main className={`${styles.appFrame} ${leftCollapsed ? styles.leftCollapsed : ""} ${isCanvasExpanded ? styles.canvasExpanded : ""}`}>
      <header className={styles.appTopbar}>
        <div className={styles.productMark}>
          <span className={styles.sunburst} />
          <strong>IRIE ANIMATE</strong>
          <small>{project?.version ?? "v1.7.2"}</small>
        </div>
        <div className={styles.breadcrumb}>
          <span>Projects</span>
          <span>/</span>
          <strong>{project?.name ?? "Aurelia"}</strong>
          <span>/</span>
          <button onClick={() => setActiveSideTab("settings")}>Experience <ChevronDown size={13} /></button>
        </div>
        <div className={styles.topbarActions}>
          <button className={styles.topIcon} aria-label="Undo" onClick={undoProject} disabled={!undoStack.length}><RotateCcw size={16} /></button>
          <button className={styles.topIcon} aria-label="Redo" onClick={redoProject} disabled={!redoStack.length}><RotateCw size={16} /></button>
          <button className={styles.darkButton} onClick={() => setIsPlaying((value) => !value)}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            Preview
          </button>
          <button className={styles.darkButton} onClick={sharePreview}><Share2 size={15} /> Share</button>
          <button className={styles.publishButton} onClick={publishPreview}>
            Prepare Export <ChevronDown size={14} />
          </button>
          <span className={styles.avatar}>AK</span>
        </div>
      </header>

      <div className={styles.editorGrid}>
        <aside className={styles.iconRail}>
          <div className={styles.iconStack}>
            {railTools.map(({ id, label, Icon }) => (
              <button
                key={label}
                className={activeRailMode === id ? styles.railIconActive : styles.railIcon}
                aria-label={label}
                onClick={() => activateRailMode(id as RailMode)}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
          <div className={styles.iconStack}>
            <button className={activeSideTab === "settings" ? styles.railIconActive : styles.railIcon} aria-label="Preferences" onClick={() => {
              setActiveSideTab("settings");
              setLeftCollapsed(false);
            }}><Settings size={18} /></button>
            <button className={helpOpen ? styles.railIconActive : styles.railIcon} aria-label="Help" onClick={() => setHelpOpen((value) => !value)}>?</button>
            <button className={styles.railIcon} aria-label="Collapse" onClick={() => setLeftCollapsed((value) => !value)}>{leftCollapsed ? "«" : "»"}</button>
          </div>
        </aside>

        <aside className={styles.leftPanel}>
          <nav className={styles.panelTabs} aria-label="Editor panels">
            {sideTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={activeSideTab === id ? styles.panelTabActive : styles.panelTab}
                onClick={() => setActiveSideTab(id)}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {activeSideTab === "brand" ? (
            <section className={styles.brandPanel}>
              <div className={styles.panelTitle}>
                <span>Brand Config</span>
                <ChevronDown size={14} />
              </div>
              <label className={styles.fieldLabel} htmlFor="brand-kit">Brand Kit</label>
              <input
                id="brand-kit"
                className={styles.textInput}
                value={project?.brand.kit ?? ""}
                onChange={(event) => updateBrand({ kit: event.target.value })}
              />

              <label className={styles.fieldLabel}>Logo</label>
              <div className={styles.logoGrid}>
                <div className={styles.logoCardInput}>
                  {logoAsset ? <img src={`/api/projects/irie-demo/assets/${logoAsset.id}`} alt="Uploaded logo" /> : null}
                  <input
                    aria-label="Logo text"
                    value={project?.brand.logoText ?? ""}
                    onChange={(event) => updateBrand({ logoText: event.target.value.toUpperCase() })}
                  />
                </div>
                <button className={styles.uploadCard} onClick={() => {
                  uploadPurposeRef.current = "logo";
                  fileInputRef.current?.click();
                }}>
                  <Upload size={15} />
                  Upload<br />SVG or PNG
                </button>
              </div>

              <label className={styles.fieldLabel}>Colors</label>
              <div className={styles.colorGrid}>
                {(project?.brand.colors ?? []).map((color, index) => (
                  <label key={`${color.name}-${index}`} className={styles.colorTile}>
                    <input type="color" value={color.hex} onChange={(event) => updateColor(index, event.target.value.toUpperCase())} />
                    <span style={{ background: color.hex }} />
                    <strong>{color.hex}</strong>
                  </label>
                ))}
              </div>

              <label className={styles.fieldLabel}>Typography</label>
              <div className={styles.typeRows}>
                {(project?.brand.typography ?? []).map((type, index) => (
                  <div key={`${type.role}-${index}`}>
                    <strong>{type.sample}</strong>
                    <input
                      value={type.family}
                      onChange={(event) => {
                        if (!project) return;
                        const typography = project.brand.typography.map((item, itemIndex) => itemIndex === index ? { ...item, family: event.target.value } : item);
                        updateBrand({ typography });
                      }}
                    />
                    <small>{type.role}</small>
                  </div>
                ))}
              </div>

              <label className={styles.fieldLabel} htmlFor="motion-tone">Motion Tone</label>
              <select
                id="motion-tone"
                className={styles.select}
                value={project?.brand.motionTone ?? "Cinematic Luxe"}
                onChange={(event) => updateBrand({ motionTone: event.target.value })}
              >
                <option value="Cinematic Luxe">Cinematic Luxe</option>
                <option value="Editorial Slow">Editorial Slow</option>
                <option value="Product Reveal">Product Reveal</option>
              </select>

              <div className={styles.scenesHeader}>
                <span>Scenes</span>
                <button aria-label="Add scene" onClick={addScene}><Plus size={16} /></button>
              </div>
              <div className={styles.sceneList}>
                {(project?.scenes ?? []).map((scene) => (
                  <button
                    key={scene.id}
                    className={currentEditorScene?.id === scene.id ? styles.sceneListActive : styles.sceneListButton}
                    onClick={() => selectEditorScene(scene.id)}
                  >
                    <span>{scene.number}</span>
                    <strong>{scene.name}</strong>
                    <SlidersHorizontal size={13} />
                  </button>
                ))}
              </div>
              <button className={styles.addScene} onClick={addScene}><Plus size={15} /> Add Scene</button>
            </section>
          ) : activeSideTab === "scenes" ? (
            <section className={styles.placeholderPanel}>
              <div className={styles.panelTitle}><span>Scenes</span></div>
              {(project?.scenes ?? []).map((scene) => (
                <label className={styles.stackField} key={scene.id}>
                  <span>{scene.number}</span>
                  <input value={scene.name} onChange={(event) => updateSceneName(scene.id, event.target.value)} />
                  <select
                    value={scene.frameSceneId}
                    onChange={(event) => {
                      if (!project) return;
                      const scenes = project.scenes.map((item) => item.id === scene.id ? { ...item, frameSceneId: event.target.value } : item);
                      setProject({ ...project, scenes });
                      void saveProject({ scenes });
                    }}
                  >
                    {(manifest?.scenes ?? []).map((frameScene) => <option key={frameScene.id} value={frameScene.id}>{frameScene.title}</option>)}
                  </select>
                </label>
              ))}
              <button className={styles.addScene} onClick={addScene}><Plus size={15} /> Add Scene</button>
            </section>
          ) : activeSideTab === "assets" ? (
            <section className={styles.placeholderPanel}>
              <div className={styles.panelTitle}><span>Assets</span></div>
              <p>{project?.assets.length ?? 0} saved local asset(s). {referenceCount ? `${referenceCount} added this session.` : ""}</p>
              {(project?.assets ?? []).map((asset) => (
                <div className={styles.assetRow} key={asset.id}>
                  <strong>{asset.name}</strong>
                  <span>{formatBytes(asset.size)}</span>
                  <small>{asset.type || "file"}</small>
                </div>
              ))}
              {(manifest?.scenes ?? []).map((scene) => (
                <div className={styles.assetRow} key={scene.id}>
                  <strong>{scene.title}</strong>
                  <span>{scene.frameCount} frames</span>
                  <small>{scene.totalMb.toFixed(2)} MB</small>
                </div>
              ))}
              <button className={styles.addScene} onClick={() => {
                uploadPurposeRef.current = "reference";
                fileInputRef.current?.click();
              }}><Upload size={15} /> Add files</button>
            </section>
          ) : (
            <section className={styles.placeholderPanel}>
              <div className={styles.panelTitle}><span>Settings</span></div>
              <label className={styles.fieldLabel}>Project name</label>
              <input className={styles.textInput} value={project?.name ?? ""} onChange={(event) => {
                if (!project) return;
                setProject({ ...project, name: event.target.value });
                void saveProject({ name: event.target.value });
              }} />
              <label className={styles.fieldLabel}>Version</label>
              <input className={styles.textInput} value={project?.version ?? ""} onChange={(event) => {
                if (!project) return;
                setProject({ ...project, version: event.target.value });
                void saveProject({ version: event.target.value });
              }} />
              <button className={styles.addScene} onClick={runDemoPipeline}><Sparkles size={15} /> Rebuild frames</button>
            </section>
          )}
        </aside>

        <section className={styles.stageColumn}>
          <div className={styles.stageHeader}>
            <select
              className={styles.stageSelect}
              value={currentEditorScene?.id ?? ""}
              onChange={(event) => selectEditorScene(event.target.value)}
              aria-label="Scene number"
            >
              {(project?.scenes ?? []).map((scene) => (
                <option key={scene.id} value={scene.id}>Scene {scene.number}</option>
              ))}
            </select>
            <select
              className={styles.stageSelect}
              value={currentEditorScene?.id ?? ""}
              onChange={(event) => selectEditorScene(event.target.value)}
              aria-label="Scene name"
            >
              {(project?.scenes ?? []).map((scene) => (
                <option key={scene.id} value={scene.id}>{scene.name}</option>
              ))}
            </select>
            <div className={styles.stageSpacer} />
            <div className={styles.segmented}>
              <button className={!isMobilePreview ? styles.segmentActive : ""} onClick={() => setIsMobilePreview(false)} aria-label="Desktop preview"><Monitor size={16} /></button>
              <button className={isMobilePreview ? styles.segmentActive : ""} onClick={() => setIsMobilePreview(true)} aria-label="Mobile preview"><Smartphone size={16} /></button>
            </div>
            <label className={styles.numericInput}>
              <input value={canvasWidth} onChange={(event) => setCanvasWidth(Number(event.target.value) || 1440)} />
              <span>w</span>
            </label>
            <label className={styles.zoomSelect}>
              <input value={zoom} onChange={(event) => setZoom(Number(event.target.value) || 63)} />
              <span>%</span>
            </label>
            <button className={styles.topIcon} aria-label="Toggle canvas focus" onClick={() => setIsCanvasExpanded((value) => !value)}><Expand size={15} /></button>
            <button className={toolMode === "select" ? styles.topIconActive : styles.topIcon} aria-label="Toggle select tool" onClick={() => setToolMode((value) => value === "select" ? "pan" : "select")}><MousePointer2 size={15} /></button>
            <button className={styles.topIcon} aria-label="Maximize preview" onClick={() => setIsCanvasExpanded((value) => !value)}><Maximize2 size={15} /></button>
          </div>

          <div className={styles.canvasShell}>
            <div
              className={`${styles.canvasViewport} ${toolMode === "pan" ? styles.canvasPanMode : ""}`}
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
            >
              <canvas ref={canvasRef} className={styles.previewCanvas} />
              <div className={styles.inCanvasMenu}>MENU <span /></div>
            </div>
          </div>

          <section className={styles.timeline}>
            <div className={styles.timelineTop}>
              <div className={styles.timelineTabs}>
                <button className={timelineView === "timeline" ? styles.timelineTabActive : ""} onClick={() => setTimelineView("timeline")}>Timeline</button>
                <button className={timelineView === "curve" ? styles.timelineTabActive : ""} onClick={() => setTimelineView("curve")}>Curve Editor</button>
              </div>
              <button className={styles.playButton} onClick={() => setIsPlaying((value) => !value)}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <strong>00:{String(Math.floor(currentSeconds)).padStart(2, "0")}.{String(Math.round((currentSeconds % 1) * 100)).padStart(2, "0")}</strong>
              <span>/</span>
              <span>00:06.50</span>
              <div className={styles.stageSpacer} />
              <label>Snap <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /></label>
              <button className={styles.topIcon} aria-label="Open clip inspector" onClick={() => setActiveRightTab("inspect")}><SlidersHorizontal size={15} /></button>
              <button className={styles.topIcon} aria-label="Maximize timeline" onClick={() => setIsCanvasExpanded((value) => !value)}><Maximize2 size={15} /></button>
            </div>

            {timelineView === "timeline" ? (
            <div className={styles.timelineGrid}>
              <div className={styles.timeHeader}>
                {["00:00", "00:01", "00:02", "00:03", "00:04", "00:05", "00:06", "00:07", "00:08"].map((time) => (
                  <span key={time}>{time}</span>
                ))}
              </div>
              <div className={styles.playhead} style={{ left: `${16 + scrub * 62}%` }} />
              {(project?.timeline ?? []).map((track: TimelineTrack) => {
                const TrackIcon = trackIcons[track.icon] ?? Box;
                return (
                <div className={styles.trackRow} key={track.label}>
                  <div className={styles.trackLabel}>
                    <TrackIcon size={16} />
                    <span>{track.label}</span>
                  </div>
                  <div className={styles.trackLane}>
                    {track.clips.map((clip) => (
                      <div
                        key={`${track.label}-${clip.text}`}
                        className={`${styles.clip} ${styles[`clip_${clip.color}`]} ${selectedClipId === clip.id ? styles.clipSelected : ""}`}
                        style={{ left: `${clip.start}%`, width: `${clip.width}%` }}
                        onClick={() => {
                          setSelectedClipId(clip.id);
                          setActiveRightTab("inspect");
                        }}
                      >
                        <span>{clip.text}</span>
                        {clip.keys.map((key) => (
                          <i key={key} style={{ left: `${key}%` }} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );})}
            </div>
            ) : (
              <div className={styles.curveEditor}>
                {(project?.timeline ?? []).flatMap((track) => track.clips.map((clip) => ({ ...clip, trackLabel: track.label }))).map((clip) => (
                  <button
                    key={clip.id}
                    className={selectedClipId === clip.id ? styles.curveRowActive : styles.curveRow}
                    onClick={() => {
                      setSelectedClipId(clip.id);
                      setActiveRightTab("inspect");
                    }}
                  >
                    <span>{clip.trackLabel}</span>
                    <strong>{clip.text}</strong>
                    <em>{clip.keys.length} keys</em>
                    <i style={{ width: `${clip.width}%`, marginLeft: `${clip.start / 2}%` }} />
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className={styles.rightPanel}>
          <nav className={styles.rightTabs}>
            {(["pipeline", "inspect", "data", "code"] as RightTab[]).map((tab) => (
              <button key={tab} className={activeRightTab === tab ? styles.rightTabActive : styles.rightTab} onClick={() => setActiveRightTab(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>

          {activeRightTab === "pipeline" ? (
            <div className={styles.rightContent}>
              <div className={styles.inlineStatus}>
                <span>Pipeline Status</span>
                <strong><i /> {lastRunAt ? `Rebuilt ${lastRunAt}` : manifest ? "Frames loaded" : "Needs run"}</strong>
              </div>
              <div className={styles.pipelineSteps}>
                {pipelineSteps.map((step) => (
                  <div key={step.label} className={step.done ? styles.pipelineDone : styles.pipelineTodo}>
                    <Check size={13} />
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>

              <div className={styles.metricBlock}>
                <div className={styles.metricTitle}><span>Preview Draw Budget</span><small>{frameBudgetMs.toFixed(1)} / 33.3 ms</small></div>
                <div className={styles.budgetBar}><span style={{ width: `${budgetRatio}%` }} /></div>
                <div className={styles.legendRow}>
                  <span><i className={styles.legendCyan} />Canvas<br /><strong>{scriptMs.toFixed(1)}ms</strong></span>
                  <span><i className={styles.legendGold} />Layout<br /><strong>{layoutMs.toFixed(1)}ms</strong></span>
                  <span><i className={styles.legendViolet} />Paint<br /><strong>{paintMs.toFixed(1)}ms</strong></span>
                  <span><i />Other<br /><strong>{otherMs.toFixed(1)}ms</strong></span>
                </div>
              </div>

              <div className={styles.metricBlock}>
                <div className={styles.metricTitle}><span>Web Vitals Gates</span><small>All good <i /></small></div>
                {(project?.vitals ?? []).map((vital) => (
                  <div className={styles.vitalRow} key={vital.label}>
                    <span>{vital.label} <ChevronDown size={12} /></span>
                    <strong>{vital.value}</strong>
                    <em>{vital.status}</em>
                    <Check size={13} />
                  </div>
                ))}
                <button className={styles.linkButton} onClick={() => setActiveRightTab("data")}>View full report <Copy size={12} /></button>
              </div>

              <div className={styles.metricBlock}>
                <div className={styles.metricTitle}><span>Deploy Checklist</span><small>{completedChecklist} / {project?.checklist.length ?? 0}</small></div>
                <div className={styles.deployProgress}><span style={{ width: `${project?.checklist.length ? (completedChecklist / project.checklist.length) * 100 : 0}%` }} /></div>
                {(project?.checklist ?? []).map((item, index) => (
                  <label className={styles.checkRow} key={item.label}>
                    <input type="checkbox" checked={item.done} onChange={(event) => updateChecklistItem(index, event.target.checked)} />
                    <span>{item.label}</span>
                  </label>
                ))}
                <button className={styles.deployButton} onClick={publishPreview}><Rocket size={15} /> Prepare export package</button>
              </div>
            </div>
          ) : null}

          {activeRightTab === "inspect" ? (
            <div className={styles.rightContent}>
              <div className={styles.metricBlock}>
                <div className={styles.metricTitle}><span>Scene Inspector</span><small>{activeScene?.title}</small></div>
                <div className={styles.inspectGrid}>
                  <span>Current frame</span><strong>{activeFrame}</strong>
                  <span>Frame count</span><strong>{activeScene?.frameCount ?? 0}</strong>
                  <span>Source</span><strong>{activeScene?.source ?? "missing"}</strong>
                  <span>Hero MB</span><strong>{heroMb.toFixed(2)}</strong>
                  <span>Loaded</span><strong>{Math.round(frameLoadProgress * 100)}%</strong>
                  <span>Last draw</span><strong>{drawMs.toFixed(2)}ms</strong>
                </div>
                <button className={styles.cookButton} onClick={runDemoPipeline} disabled={isGenerating}>
                  <Sparkles size={14} /> {isGenerating ? "Cooking..." : "Cook frames"}
                </button>
              </div>
              <div className={styles.metricBlock}>
                <div className={styles.metricTitle}><span>Selected Clip</span><small>{selectedClip?.trackId ?? "none"}</small></div>
                <label className={styles.stackField}>
                  <span>Name</span>
                  <input value={selectedClip?.text ?? ""} onChange={(event) => updateSelectedClip({ text: event.target.value })} />
                </label>
                <label className={styles.stackField}>
                  <span>Start %</span>
                  <input
                    type="number"
                    min={0}
                    max={98}
                    value={selectedClip?.start ?? 0}
                    onChange={(event) => updateSelectedClip({ start: Number(event.target.value) || 0 })}
                  />
                </label>
                <label className={styles.stackField}>
                  <span>Width %</span>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={selectedClip?.width ?? 0}
                    onChange={(event) => updateSelectedClip({ width: Number(event.target.value) || 2 })}
                  />
                </label>
              </div>
              <div className={styles.metricBlock}>
                <div className={styles.metricTitle}><span>Vitals Editor</span><small>local gates</small></div>
                {(project?.vitals ?? []).map((vital, index) => (
                  <label className={styles.stackField} key={vital.label}>
                    <span>{vital.label}</span>
                    <input value={vital.value} onChange={(event) => updateVital(index, { value: event.target.value })} />
                    <select value={vital.status} onChange={(event) => updateVital(index, { status: event.target.value as "Good" | "Watch" })}>
                      <option value="Good">Good</option>
                      <option value="Watch">Watch</option>
                    </select>
                  </label>
                ))}
              </div>
              {publishResult ? <p className={styles.note}>{publishResult}</p> : null}
              {manifestError ? <p className={styles.errorText}>{manifestError}</p> : null}
            </div>
          ) : null}

          {activeRightTab === "data" ? (
            <div className={styles.rightContent}>
              <pre className={styles.dataBlock}>{JSON.stringify({ project, manifest }, null, 2)}</pre>
            </div>
          ) : null}

          {activeRightTab === "code" ? (
            <div className={styles.rightContent}>
              <pre className={styles.codeBlock}>{codeSnippet}</pre>
              <button className={styles.cookButton} onClick={exportSite}><FileCode2 size={14} /> Export static site</button>
            </div>
          ) : null}
        </aside>
      </div>

      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime"
        onChange={(event) => {
          void uploadReferenceFiles(event.target.files, uploadPurposeRef.current);
          uploadPurposeRef.current = "reference";
          event.target.value = "";
        }}
      />

      {helpOpen ? (
        <section className={styles.helpDrawer} aria-label="Irie Animate help">
          <button aria-label="Close help" onClick={() => setHelpOpen(false)}>×</button>
          <strong>Engine reality</strong>
          <p>Irie Animate builds scroll animation from WebP frame sequences. The preview canvas scrubs those frames by playhead or playback.</p>
          <p>The local cook step can generate motion from a bitmap reference, or extract frames from real MP4 sources when scenes point at videos.</p>
          <p>Remote Vercel deployment is not authenticated here, so this build prepares a real static export package.</p>
        </section>
      ) : null}

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </main>
  );
}

function findNearestFrame(frames: Array<HTMLImageElement | undefined>, index: number) {
  for (let offset = 1; offset < frames.length; offset += 1) {
    const before = frames[index - offset];
    if (before) return before;
    const after = frames[index + offset];
    if (after) return after;
  }
  return undefined;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
