import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type TimelineClip = {
  id: string;
  start: number;
  width: number;
  text: string;
  color: "gold" | "amber" | "cyan" | "violet";
  keys: number[];
};

export type TimelineTrack = {
  id: string;
  icon: "camera" | "box" | "type" | "sun" | "waves" | "sparkles";
  label: string;
  clips: TimelineClip[];
};

export type EditorScene = {
  id: string;
  number: string;
  name: string;
  frameSceneId: string;
  target: string;
};

export type EditorProject = {
  id: string;
  name: string;
  version: string;
  brandId: string;
  activeSceneId: string;
  brand: {
    kit: string;
    logoText: string;
    logoAssetId?: string;
    motionTone: string;
    colors: Array<{ name: string; hex: string }>;
    typography: Array<{ role: string; family: string; sample: string }>;
  };
  scenes: EditorScene[];
  timeline: TimelineTrack[];
  assets: Array<{ id: string; name: string; type: string; size: number; path: string; addedAt: string; purpose?: "reference" | "logo" }>;
  checklist: Array<{ label: string; done: boolean }>;
  vitals: Array<{ label: string; value: string; status: "Good" | "Watch" }>;
  updatedAt: string;
};

const projectDir = resolve(process.cwd(), ".irie-animate", "projects", "irie-demo");
const projectPath = resolve(projectDir, "project.json");

export async function readProject(): Promise<EditorProject> {
  await ensureProject();
  return normalizeProject(JSON.parse(await readFile(projectPath, "utf8")));
}

export async function updateProject(patch: Partial<EditorProject>): Promise<EditorProject> {
  const current = await readProject();
  const next = mergeProject(current, patch);
  await mkdir(projectDir, { recursive: true });
  await writeFile(projectPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

async function ensureProject() {
  if (existsSync(projectPath)) return;
  await mkdir(projectDir, { recursive: true });
  await writeFile(projectPath, `${JSON.stringify(createSeedProject(), null, 2)}\n`, "utf8");
}

function mergeProject(current: EditorProject, patch: Partial<EditorProject>): EditorProject {
  return {
    ...current,
    ...patch,
    brand: patch.brand ? { ...current.brand, ...patch.brand } : current.brand,
    updatedAt: new Date().toISOString()
  };
}

function normalizeProject(project: EditorProject): EditorProject {
  return {
    ...project,
    brand: {
      ...project.brand,
      logoText: project.brand?.logoText ?? "AURELIA"
    },
    assets: project.assets ?? [],
    checklist: project.checklist ?? [],
    vitals: project.vitals ?? []
  };
}

function createSeedProject(): EditorProject {
  return {
    id: "irie-demo",
    name: "Aurelia",
    version: "v1.7.2",
    brandId: "irie-demo",
    activeSceneId: "hero",
    brand: {
      kit: "Aurelia",
      logoText: "AURELIA",
      motionTone: "Cinematic Luxe",
      colors: [
        { name: "Gold", hex: "#D8B97A" },
        { name: "Ink", hex: "#0E0E10" },
        { name: "Slate", hex: "#666B72" },
        { name: "Cyan", hex: "#00E5FF" }
      ],
      typography: [
        { role: "Headings", family: "Cinzel", sample: "Aa" },
        { role: "Body", family: "Inter", sample: "Aa" }
      ]
    },
    scenes: [
      { id: "hero", number: "01", name: "Hero", frameSceneId: "hero", target: "hero" },
      { id: "craft", number: "02", name: "Craft", frameSceneId: "gallery", target: "gallery" },
      { id: "details", number: "03", name: "Details", frameSceneId: "logo", target: "footer" },
      { id: "ritual", number: "04", name: "Ritual", frameSceneId: "hero", target: "hero" },
      { id: "reveal", number: "05", name: "Reveal", frameSceneId: "gallery", target: "gallery" },
      { id: "legacy", number: "06", name: "Legacy", frameSceneId: "logo", target: "footer" }
    ],
    timeline: [
      { id: "camera", icon: "camera", label: "Camera", clips: [{ id: "camera-push", start: 15, width: 27, text: "Camera Push In", color: "gold", keys: [0, 62, 98] }] },
      { id: "bottle", icon: "box", label: "Bottle", clips: [{ id: "bottle-parallax", start: 15, width: 42, text: "Parallax Up", color: "cyan", keys: [0, 58, 74, 100] }, { id: "bottle-rotate", start: 59, width: 41, text: "Rotate Y", color: "cyan", keys: [100] }] },
      { id: "title", icon: "type", label: "Title", clips: [{ id: "title-main", start: 14, width: 62, text: "Essence of Elements", color: "amber", keys: [0, 73, 90] }] },
      { id: "subtitle", icon: "type", label: "Subtitle", clips: [{ id: "subtitle-main", start: 15, width: 62, text: "Scroll to Discover", color: "amber", keys: [0, 70, 88] }] },
      { id: "light", icon: "sun", label: "Light", clips: [{ id: "light-bloom", start: 14, width: 66, text: "Shift & Bloom", color: "violet", keys: [0, 58, 86] }] },
      { id: "water", icon: "waves", label: "Water", clips: [{ id: "water-ripples", start: 15, width: 66, text: "Ripples", color: "cyan", keys: [0, 98] }] },
      { id: "particles", icon: "sparkles", label: "Particles", clips: [{ id: "particles-mist", start: 14, width: 67, text: "Mist", color: "cyan", keys: [0, 97] }] }
    ],
    assets: [],
    checklist: ["Scenes complete", "Assets optimized", "Web Vitals pass", "Accessibility audit", "SEO & metadata", "Favicon & social image", "Custom domain", "Final preview", "Deploy"].map((label, index) => ({ label, done: index < 8 })),
    vitals: [
      { label: "LCP", value: "1.2s", status: "Good" },
      { label: "INP", value: "78ms", status: "Good" },
      { label: "CLS", value: "0.03", status: "Good" },
      { label: "TBT", value: "120ms", status: "Good" }
    ],
    updatedAt: new Date().toISOString()
  };
}
