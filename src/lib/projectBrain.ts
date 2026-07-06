import type { EditorProject } from "./projectStore";
import type { FramesManifest } from "./types";

export type BrainIssue = {
  label: string;
  detail: string;
  severity: "good" | "watch" | "blocked";
};

export type ProjectBrain = {
  score: number;
  engineMode: "video-source" | "bitmap-reference" | "fallback-generated" | "needs-source";
  summary: string;
  strengths: BrainIssue[];
  blockers: BrainIssue[];
  recommendations: BrainIssue[];
  nextActions: string[];
  stats: {
    assets: number;
    videos: number;
    images: number;
    scenes: number;
    mappedSources: number;
    renderedFrames: number;
    totalMb: number;
    heroMb: number;
    checklistDone: number;
    checklistTotal: number;
    watchedVitals: number;
  };
};

export function analyzeProject(project: EditorProject, manifest?: FramesManifest | null): ProjectBrain {
  const videoAssets = project.assets.filter(isVideoAsset);
  const imageAssets = project.assets.filter(isImageAsset);
  const mappedSources = project.scenes.filter((scene) => {
    const asset = project.assets.find((item) => item.id === scene.sourceAssetId);
    return Boolean(asset && isVideoAsset(asset));
  });
  const renderedFrames = manifest?.scenes.reduce((sum, scene) => sum + scene.frameCount, 0) ?? 0;
  const totalMb = manifest?.scenes.reduce((sum, scene) => sum + scene.totalMb, 0) ?? 0;
  const heroMb = manifest?.scenes.find((scene) => scene.target === "hero")?.totalMb ?? 0;
  const checklistDone = project.checklist.filter((item) => item.done).length;
  const watchedVitals = project.vitals.filter((item) => item.status === "Watch").length;
  const budgetBlocked = Boolean(manifest && (totalMb > manifest.budgets.totalMaxMb || heroMb > manifest.budgets.heroMaxMb));
  const hasRenderedFrames = Boolean(manifest?.scenes.length && renderedFrames > 0);
  const hasSourceAssignments = mappedSources.length > 0;

  const engineMode = getEngineMode({ videoCount: videoAssets.length, imageCount: imageAssets.length, hasSourceAssignments, hasRenderedFrames });
  const strengths: BrainIssue[] = [];
  const blockers: BrainIssue[] = [];
  const recommendations: BrainIssue[] = [];

  if (hasRenderedFrames) {
    strengths.push({ label: "Frame engine online", detail: `${renderedFrames} optimized frames are available for canvas scrub playback.`, severity: "good" });
  } else {
    blockers.push({ label: "No rendered frames", detail: "Run Cook Frames so the preview and export have a real frame sequence.", severity: "blocked" });
  }

  if (hasSourceAssignments) {
    strengths.push({ label: "Video source mapped", detail: `${mappedSources.length} scene(s) point at uploaded video source files.`, severity: "good" });
  } else if (videoAssets.length) {
    recommendations.push({ label: "Unmapped videos", detail: `${videoAssets.length} video asset(s) are uploaded but not assigned to scenes yet.`, severity: "watch" });
  } else {
    blockers.push({ label: "No video source", detail: "Upload at least one MP4/MOV if this project should cook from real footage instead of demo references.", severity: "blocked" });
  }

  if (imageAssets.length) {
    strengths.push({ label: "Reference kit staged", detail: `${imageAssets.length} image reference(s) can guide the brand and export package.`, severity: "good" });
  } else {
    recommendations.push({ label: "Reference kit thin", detail: "Add product, texture, or mood references so the builder has more brand truth.", severity: "watch" });
  }

  if (budgetBlocked) {
    blockers.push({ label: "Frame budget over", detail: `Hero ${heroMb.toFixed(2)} MB, total ${totalMb.toFixed(2)} MB. Tighten frames or compression before deploy.`, severity: "blocked" });
  } else if (manifest) {
    strengths.push({ label: "Frame budget pass", detail: `Hero ${heroMb.toFixed(2)} MB, total ${totalMb.toFixed(2)} MB.`, severity: "good" });
  }

  if (watchedVitals) {
    recommendations.push({ label: "Vitals need review", detail: `${watchedVitals} local vital gate(s) are marked Watch.`, severity: "watch" });
  } else {
    strengths.push({ label: "Vitals clean", detail: "Local vitals gates are marked Good.", severity: "good" });
  }

  const incompleteChecklist = project.checklist.length - checklistDone;
  if (incompleteChecklist > 0) {
    recommendations.push({ label: "Launch checklist open", detail: `${incompleteChecklist} checklist item(s) remain before production handoff.`, severity: "watch" });
  }

  const score = scoreProject({
    hasRenderedFrames,
    hasSourceAssignments,
    videoCount: videoAssets.length,
    imageCount: imageAssets.length,
    budgetBlocked,
    watchedVitals,
    checklistRatio: project.checklist.length ? checklistDone / project.checklist.length : 0
  });

  return {
    score,
    engineMode,
    summary: getSummary(engineMode, score),
    strengths,
    blockers,
    recommendations,
    nextActions: getNextActions({ hasRenderedFrames, hasSourceAssignments, videoAssets: videoAssets.length, imageAssets: imageAssets.length, budgetBlocked, watchedVitals, incompleteChecklist }),
    stats: {
      assets: project.assets.length,
      videos: videoAssets.length,
      images: imageAssets.length,
      scenes: project.scenes.length,
      mappedSources: mappedSources.length,
      renderedFrames,
      totalMb: Number(totalMb.toFixed(2)),
      heroMb: Number(heroMb.toFixed(2)),
      checklistDone,
      checklistTotal: project.checklist.length,
      watchedVitals
    }
  };
}

export function isVideoAsset(asset: Pick<EditorProject["assets"][number], "type" | "name">) {
  return asset.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(asset.name);
}

export function isImageAsset(asset: Pick<EditorProject["assets"][number], "type" | "name">) {
  return asset.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(asset.name);
}

function getEngineMode(input: { videoCount: number; imageCount: number; hasSourceAssignments: boolean; hasRenderedFrames: boolean }): ProjectBrain["engineMode"] {
  if (input.hasSourceAssignments) return "video-source";
  if (input.imageCount > 0) return "bitmap-reference";
  if (input.hasRenderedFrames) return "fallback-generated";
  return input.videoCount > 0 ? "needs-source" : "needs-source";
}

function scoreProject(input: {
  hasRenderedFrames: boolean;
  hasSourceAssignments: boolean;
  videoCount: number;
  imageCount: number;
  budgetBlocked: boolean;
  watchedVitals: number;
  checklistRatio: number;
}) {
  let score = 10;
  if (input.hasRenderedFrames) score += 26;
  if (input.hasSourceAssignments) score += 22;
  else if (input.videoCount > 0) score += 10;
  if (input.imageCount > 0) score += 10;
  score += Math.round(input.checklistRatio * 18);
  if (!input.budgetBlocked) score += 10;
  score -= input.watchedVitals * 6;
  if (input.budgetBlocked) score -= 18;
  return Math.max(0, Math.min(100, score));
}

function getSummary(mode: ProjectBrain["engineMode"], score: number) {
  if (mode === "video-source") return `Ready to cook from real source footage. Brain confidence: ${score}%.`;
  if (mode === "bitmap-reference") return `Working from reference imagery. Real video cooking unlocks once scenes are mapped to MP4/MOV assets. Brain confidence: ${score}%.`;
  if (mode === "fallback-generated") return `The frame engine is alive, but it is using generated fallback frames. Brain confidence: ${score}%.`;
  return `The editor needs source media before it can produce a serious branded animation. Brain confidence: ${score}%.`;
}

function getNextActions(input: {
  hasRenderedFrames: boolean;
  hasSourceAssignments: boolean;
  videoAssets: number;
  imageAssets: number;
  budgetBlocked: boolean;
  watchedVitals: number;
  incompleteChecklist: number;
}) {
  const actions: string[] = [];
  if (!input.videoAssets) actions.push("Upload one or more MP4/MOV clips as scene source footage.");
  if (input.videoAssets && !input.hasSourceAssignments) actions.push("Map uploaded video assets to editor scenes.");
  if (!input.imageAssets) actions.push("Add a small reference kit for logo, product texture, and color mood.");
  if (!input.hasRenderedFrames) actions.push("Run Cook Frames to rebuild the frame manifest from current project state.");
  if (input.budgetBlocked) actions.push("Reduce frame count or compression weight before preparing an export.");
  if (input.watchedVitals) actions.push("Resolve Watch vitals in the Inspect panel.");
  if (input.incompleteChecklist) actions.push("Close launch checklist items before handoff.");
  if (!actions.length) actions.push("Prepare export package and review the static scroll site.");
  return actions.slice(0, 5);
}
