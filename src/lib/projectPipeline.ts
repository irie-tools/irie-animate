import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBrandConfigFromProject } from "./projectBrand";
import { readProject } from "./projectStore";
import type { FramesManifest } from "./types";

export type ProjectPipelineResult = {
  manifest: FramesManifest;
  mode: "video-source" | "demo-reference";
  log: string;
};

export async function cookProjectFrames(): Promise<ProjectPipelineResult> {
  const cwd = process.cwd();
  const project = await readProject();
  const generatedDir = resolve(cwd, ".irie-animate", "build");
  const generatedConfigPath = resolve(generatedDir, `${project.brandId}.generated-brand.json`);
  const generatedBrand = buildBrandConfigFromProject(project);

  await mkdir(generatedDir, { recursive: true });
  await writeFile(generatedConfigPath, `${JSON.stringify(generatedBrand, null, 2)}\n`, "utf8");

  const hasVideoSources = generatedBrand.scenes.some((scene) => Boolean(scene.sourceVideo));
  const args = ["pipeline/build-frames.mjs", "--config", generatedConfigPath];
  if (!hasVideoSources) args.push("--demo");

  const result = spawnSync("node", args, {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Pipeline failed.");
  }

  const manifestPath = resolve(cwd, "public", "frames", project.brandId, "frames.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FramesManifest;

  return {
    manifest,
    mode: hasVideoSources ? "video-source" : "demo-reference",
    log: result.stdout
  };
}
