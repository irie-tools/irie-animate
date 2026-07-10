import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { NextResponse } from "next/server";
import { readProject, safeProjectId } from "@/src/lib/projectStore";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const safeId = safeProjectId(projectId);
    await readProject(safeId);
    const exportsRoot = resolve(process.cwd(), "exports");
    const exportDir = resolve(exportsRoot, `${safeId}-animated-site`);
    if (!existsSync(resolve(exportDir, "index.html"))) {
      return NextResponse.json({ error: "Generate the site before downloading it." }, { status: 404 });
    }

    const archivePath = resolve(exportsRoot, `${safeId}-animated-site.zip`);
    await rm(archivePath, { force: true });
    const result = spawnSync("zip", ["-r", "-q", archivePath, basename(exportDir), "-x", "*.DS_Store", "*/._*", "__MACOSX/*"], {
      cwd: exportsRoot,
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      encoding: "utf8",
      timeout: 120_000
    });
    if (result.status !== 0 || !existsSync(archivePath)) throw new Error(result.stderr || "Could not package the site.");

    return new Response(await readFile(archivePath), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeId}-animated-site.zip"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Download failed." }, { status: 500 });
  }
}
