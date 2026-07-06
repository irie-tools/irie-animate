import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";
import { buildBrandConfigFromProject } from "@/src/lib/projectBrand";
import { readProject } from "@/src/lib/projectStore";

export const runtime = "nodejs";

export async function POST() {
  const cwd = process.cwd();
  const project = await readProject();
  const generatedDir = resolve(cwd, ".irie-animate", "build");
  const generatedConfigPath = resolve(generatedDir, `${project.brandId}.generated-brand.json`);
  const generatedBrand = buildBrandConfigFromProject(project);

  await mkdir(generatedDir, { recursive: true });
  await writeFile(generatedConfigPath, `${JSON.stringify(generatedBrand, null, 2)}\n`, "utf8");

  const result = spawnSync("node", ["pipeline/build-frames.mjs", "--config", generatedConfigPath, "--demo"], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });

  if (result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: result.stderr || result.stdout || "Pipeline failed."
      },
      { status: 500 }
    );
  }

  const manifestPath = resolve(cwd, "public", "frames", project.brandId, "frames.manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  return NextResponse.json({
    ok: true,
    manifest,
    log: result.stdout
  });
}
