import baseBrand from "../../brands/irie-demo.json";
import { isVideoAsset } from "./projectBrain";
import type { BrandConfig, BrandScene, SceneTarget } from "./types";
import type { EditorProject } from "./projectStore";

const base = baseBrand as BrandConfig;

export function buildBrandConfigFromProject(project: EditorProject): BrandConfig {
  const posterAsset = project.generated?.posterAssetId ? project.assets.find((asset) => asset.id === project.generated?.posterAssetId) : undefined;
  const scenes = base.scenes.map((scene) => {
    const editorScene = project.scenes.find((item) => item.frameSceneId === scene.id);
    const sourceAsset = editorScene?.sourceAssetId ? project.assets.find((asset) => asset.id === editorScene.sourceAssetId) : null;
    const sourceVideo = sourceAsset && isVideoAsset(sourceAsset) ? sourceAsset.path : undefined;
    return {
      ...scene,
      title: editorScene?.name || scene.title,
      target: normalizeTarget(editorScene?.target || scene.target),
      frames: project.recipe?.frameCount ?? scene.frames,
      sourceVideo
    };
  });

  return {
    ...base,
    id: project.brandId,
    name: project.name || project.brand.kit || base.name,
    logoText: project.brand.logoText || base.logoText,
    motionTone: project.brand.motionTone || base.motionTone,
    tagline: project.intake?.description || `${project.brand.motionTone || base.motionTone} scroll experience built from ${project.scenes.length} editor scene(s).`,
    demoSource: posterAsset ? { imagePath: posterAsset.path, crop: { left: 0, top: 0, width: 1600, height: 900 } } : base.demoSource,
    colors: {
      background: getColor(project, "Ink", 1, base.colors.background),
      surface: base.colors.surface,
      text: "#F4F0E8",
      muted: getColor(project, "Slate", 2, base.colors.muted),
      accent: getColor(project, "Cyan", 3, base.colors.accent),
      secondary: getColor(project, "Gold", 0, base.colors.secondary)
    },
    scenes: scenes as BrandScene[],
    specs: [
      { label: "Frame engine", value: "Canvas frame scrub" },
      { label: "Project scenes", value: `${project.scenes.length}` },
      { label: "Mapped videos", value: `${project.scenes.filter((scene) => scene.sourceAssetId).length}` },
      { label: "Timeline tracks", value: `${project.timeline.length}` },
      { label: "Export source", value: "Local project JSON" }
    ],
    workflow: [
      { label: "Project state loaded", status: "ready" },
      { label: `${project.assets.length} local asset(s) stored`, status: project.assets.length ? "ready" : "manual" },
      { label: "Frames optimized", status: "ready" },
      { label: "Static export prepared", status: project.checklist.at(-1)?.done ? "ready" : "manual" }
    ]
  };
}

function getColor(project: EditorProject, name: string, index: number, fallback: string) {
  return project.brand.colors.find((color) => color.name === name)?.hex ?? project.brand.colors[index]?.hex ?? fallback;
}

function normalizeTarget(target: string): SceneTarget {
  if (target === "hero" || target === "gallery" || target === "specs" || target === "footer") return target;
  return "hero";
}
