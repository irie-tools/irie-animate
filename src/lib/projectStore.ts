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
  sourceAssetId?: string;
};

export type MotionIntensity = "calm" | "loud" | "unhinged";

export type StorefrontProduct = {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  purchaseUrl: string;
  category?: string;
  assetId?: string;
};

export type StorefrontIntake = {
  sourceUrl: string;
  shopUrl: string;
  brandName: string;
  headline: string;
  description: string;
  palette: string[];
  products: StorefrontProduct[];
  socialLinks: string[];
  importedAt: string;
};

export type MotionRecipe = {
  intensity: MotionIntensity;
  heroDuration: number;
  frameCount: number;
  selectedProductIds: string[];
  palette: string[];
  chapters: string[];
};

export type GeneratedMedia = {
  heroVideoAssetId?: string;
  mobileVideoAssetId?: string;
  posterAssetId?: string;
  exportDir?: string;
  generatedAt?: string;
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
  assets: Array<{ id: string; name: string; type: string; size: number; path: string; addedAt: string; purpose?: "reference" | "logo" | "source" }>;
  checklist: Array<{ label: string; done: boolean }>;
  vitals: Array<{ label: string; value: string; status: "Good" | "Watch" }>;
  intake?: StorefrontIntake;
  recipe?: MotionRecipe;
  generated?: GeneratedMedia;
  updatedAt: string;
};

const DEFAULT_PROJECT_ID = "irie-demo";
const projectsRoot = resolve(process.cwd(), ".irie-animate", "projects");

export function getProjectDir(projectId: string) {
  return resolve(projectsRoot, safeProjectId(projectId));
}

export function projectExists(projectId: string) {
  return existsSync(resolve(getProjectDir(projectId), "project.json"));
}

export async function readProject(projectId = DEFAULT_PROJECT_ID): Promise<EditorProject> {
  if (projectId === DEFAULT_PROJECT_ID) await ensureDefaultProject();
  const projectPath = resolve(getProjectDir(projectId), "project.json");
  if (!existsSync(projectPath)) throw new Error(`Project not found: ${projectId}`);
  return normalizeProject(JSON.parse(await readFile(projectPath, "utf8")) as EditorProject);
}

export async function createProject(input: { id: string; name: string; intake?: StorefrontIntake }): Promise<EditorProject> {
  const id = safeProjectId(input.id);
  if (projectExists(id)) throw new Error(`Project already exists: ${id}`);
  const project = createSeedProject({ id, name: input.name, intake: input.intake });
  await writeProject(project);
  return project;
}

export async function updateProject(projectId: string, patch: Partial<EditorProject>): Promise<EditorProject> {
  const current = await readProject(projectId);
  const next = mergeProject(current, patch);
  await writeProject(next);
  return next;
}

async function writeProject(project: EditorProject) {
  const projectDir = getProjectDir(project.id);
  await mkdir(projectDir, { recursive: true });
  await writeFile(resolve(projectDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
}

async function ensureDefaultProject() {
  const projectPath = resolve(getProjectDir(DEFAULT_PROJECT_ID), "project.json");
  if (existsSync(projectPath)) return;
  await writeProject(createSeedProject({ id: DEFAULT_PROJECT_ID, name: "Aurelia" }));
}

function mergeProject(current: EditorProject, patch: Partial<EditorProject>): EditorProject {
  return normalizeProject({
    ...current,
    ...patch,
    id: current.id,
    brandId: patch.brandId ? safeProjectId(patch.brandId) : current.brandId,
    brand: patch.brand ? { ...current.brand, ...patch.brand } : current.brand,
    recipe: patch.recipe ? { ...(current.recipe ?? defaultRecipe()), ...patch.recipe } : current.recipe,
    generated: patch.generated ? { ...(current.generated ?? {}), ...patch.generated } : current.generated,
    updatedAt: new Date().toISOString()
  });
}

function normalizeProject(project: EditorProject): EditorProject {
  return {
    ...project,
    brand: {
      ...project.brand,
      logoText: project.brand?.logoText ?? project.name.toUpperCase()
    },
    scenes: (project.scenes ?? []).map((scene) => ({ ...scene, sourceAssetId: scene.sourceAssetId })),
    assets: project.assets ?? [],
    checklist: project.checklist ?? [],
    vitals: project.vitals ?? [],
    recipe: project.recipe ?? defaultRecipe(),
    generated: project.generated ?? {}
  };
}

function createSeedProject(input: { id: string; name: string; intake?: StorefrontIntake }): EditorProject {
  const palette = input.intake?.palette?.length ? input.intake.palette : ["#D8B97A", "#0E0E10", "#666B72", "#00E5FF"];
  const logoText = input.intake?.brandName?.toUpperCase() || input.name.toUpperCase();
  return {
    id: input.id,
    name: input.name,
    version: "v2.0.0",
    brandId: input.id,
    activeSceneId: "hero",
    brand: {
      kit: input.intake?.brandName || input.name,
      logoText,
      motionTone: "Loud",
      colors: [
        { name: "Gold", hex: palette[2] ?? palette[0] ?? "#D8B97A" },
        { name: "Ink", hex: palette[0] ?? "#0E0E10" },
        { name: "Slate", hex: "#666B72" },
        { name: "Cyan", hex: palette[1] ?? "#00E5FF" }
      ],
      typography: [
        { role: "Headings", family: "Archivo Black", sample: "Aa" },
        { role: "Body", family: "Inter", sample: "Aa" }
      ]
    },
    scenes: defaultScenes(),
    timeline: defaultTimeline(),
    assets: [],
    checklist: ["Store imported", "Products selected", "Hero film generated", "Frames optimized", "Mobile payload pass", "Copy reviewed", "Static export prepared", "Final preview", "Deploy"].map((label) => ({ label, done: false })),
    vitals: [
      { label: "LCP", value: "pending", status: "Watch" },
      { label: "INP", value: "pending", status: "Watch" },
      { label: "CLS", value: "pending", status: "Watch" },
      { label: "TBT", value: "pending", status: "Watch" }
    ],
    intake: input.intake,
    recipe: defaultRecipe(input.intake?.products.slice(0, 6).map((product) => product.id)),
    generated: {},
    updatedAt: new Date().toISOString()
  };
}

function defaultScenes(): EditorScene[] {
  return [
    { id: "hero", number: "01", name: "Hero", frameSceneId: "hero", target: "hero" },
    { id: "philosophy", number: "02", name: "Philosophy", frameSceneId: "gallery", target: "gallery" },
    { id: "drop", number: "03", name: "Featured Drop", frameSceneId: "logo", target: "specs" },
    { id: "story", number: "04", name: "Product Story", frameSceneId: "hero", target: "hero" },
    { id: "community", number: "05", name: "Community", frameSceneId: "gallery", target: "gallery" },
    { id: "shop", number: "06", name: "Shop", frameSceneId: "logo", target: "footer" }
  ];
}

function defaultTimeline(): TimelineTrack[] {
  return [
    { id: "camera", icon: "camera", label: "Camera", clips: [{ id: "camera-push", start: 12, width: 30, text: "Camera Push In", color: "gold", keys: [0, 60, 100] }] },
    { id: "product", icon: "box", label: "Product", clips: [{ id: "product-parallax", start: 12, width: 58, text: "Product Parallax", color: "cyan", keys: [0, 55, 82, 100] }] },
    { id: "title", icon: "type", label: "Title", clips: [{ id: "title-main", start: 10, width: 64, text: "Primary Headline", color: "amber", keys: [0, 72, 92] }] },
    { id: "subtitle", icon: "type", label: "Subtitle", clips: [{ id: "subtitle-main", start: 15, width: 58, text: "Brand Promise", color: "amber", keys: [0, 68, 90] }] },
    { id: "light", icon: "sun", label: "Light", clips: [{ id: "light-bloom", start: 8, width: 72, text: "Color Shift", color: "violet", keys: [0, 55, 88] }] },
    { id: "particles", icon: "sparkles", label: "Texture", clips: [{ id: "texture-grain", start: 10, width: 70, text: "Film Grain", color: "cyan", keys: [0, 100] }] }
  ];
}

function defaultRecipe(selectedProductIds: string[] = []): MotionRecipe {
  return {
    intensity: "loud",
    heroDuration: 10,
    frameCount: 96,
    selectedProductIds,
    palette: ["#0A0A08", "#A8FF2E", "#FFD51F", "#ED2C25"],
    chapters: ["Hero", "Brand philosophy", "Featured drop", "Product story", "Community", "Shop"]
  };
}

export function safeProjectId(value: string) {
  const safe = value.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
  if (!safe) throw new Error("Project id is required.");
  return safe;
}
