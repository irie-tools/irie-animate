import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { analyzeProject, isVideoAsset } from "@/src/lib/projectBrain";
import { readProject, updateProject } from "@/src/lib/projectStore";
import type { FramesManifest } from "@/src/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") || "irie-demo";
  const project = await readProject(projectId);
  const manifest = await readManifest(project.brandId);
  return NextResponse.json({ ok: true, brain: analyzeProject(project, manifest) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const projectId = typeof body?.projectId === "string" ? body.projectId : "irie-demo";
  const project = await readProject(projectId);

  if (action === "auto-map-sources") {
    const videoAssets = project.assets.filter(isVideoAsset);
    if (!videoAssets.length) {
      return NextResponse.json({ ok: false, error: "Upload video assets before auto-mapping sources." }, { status: 400 });
    }

    const scenes = project.scenes.map((scene, index) => ({
      ...scene,
      sourceAssetId: scene.sourceAssetId ?? videoAssets[index % videoAssets.length]?.id
    }));
    const assets = project.assets.map((asset) => isVideoAsset(asset) ? { ...asset, purpose: "source" as const } : asset);
    const updated = await updateProject(projectId, { scenes, assets });
    const manifest = await readManifest(updated.brandId);
    return NextResponse.json({ ok: true, project: updated, brain: analyzeProject(updated, manifest) });
  }

  if (action === "apply-checklist") {
    const manifest = await readManifest(project.brandId);
    const totalMb = manifest?.scenes.reduce((sum, scene) => sum + scene.totalMb, 0) ?? 0;
    const heroMb = manifest?.scenes.find((scene) => scene.target === "hero")?.totalMb ?? 0;
    const withinBudget = manifest ? totalMb <= manifest.budgets.totalMaxMb && heroMb <= manifest.budgets.heroMaxMb : false;
    const vitalsGood = project.vitals.every((vital) => vital.status === "Good");
    const scenesMapped = project.scenes.every((scene) => scene.frameSceneId);
    const hasAssets = project.assets.length > 0;

    const checklist = project.checklist.map((item) => {
      if (item.label === "Scenes complete") return { ...item, done: scenesMapped };
      if (item.label === "Store imported") return { ...item, done: Boolean(project.intake) };
      if (item.label === "Products selected") return { ...item, done: Boolean(project.recipe?.selectedProductIds.length) };
      if (item.label === "Hero film generated") return { ...item, done: Boolean(project.generated?.heroVideoAssetId) };
      if (item.label === "Assets optimized" || item.label === "Frames optimized") return { ...item, done: hasAssets && withinBudget };
      if (item.label === "Mobile payload pass") return { ...item, done: withinBudget };
      if (item.label === "Web Vitals pass") return { ...item, done: vitalsGood };
      if (item.label === "Final preview") return { ...item, done: Boolean(manifest?.scenes.length) };
      return item;
    });
    const updated = await updateProject(projectId, { checklist });
    return NextResponse.json({ ok: true, project: updated, brain: analyzeProject(updated, manifest) });
  }

  return NextResponse.json({ ok: false, error: "Unknown brain action." }, { status: 400 });
}

async function readManifest(brandId: string): Promise<FramesManifest | null> {
  const manifestPath = resolve(process.cwd(), "public", "frames", brandId, "frames.manifest.json");
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(await readFile(manifestPath, "utf8")) as FramesManifest;
}
