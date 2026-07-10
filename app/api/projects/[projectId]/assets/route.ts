import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { isVideoAsset } from "@/src/lib/projectBrain";
import { getProjectDir, projectExists, readProject, updateProject, type EditorProject } from "../../../../../src/lib/projectStore";

type ProjectAsset = EditorProject["assets"][number];
type AssetPurpose = NonNullable<ProjectAsset["purpose"]>;

type Params = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    if (!projectExists(projectId)) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
    const assetsDir = resolve(getProjectDir(projectId), "assets");
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const requestedPurpose: AssetPurpose = formData.get("purpose") === "logo" ? "logo" : "reference";

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No files were provided." }, { status: 400 });
    }

    await mkdir(assetsDir, { recursive: true });
    const current = await readProject(projectId);
    const savedAssets: ProjectAsset[] = [];

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = resolve(assetsDir, `${id}-${safeName}`);
      await writeFile(path, bytes);
      const purpose: AssetPurpose = requestedPurpose === "reference" && isVideoAsset({ name: file.name, type: file.type }) ? "source" : requestedPurpose;
      savedAssets.push({
        id,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        path,
        addedAt: new Date().toISOString(),
        purpose
      });
    }

    const project = await updateProject(projectId, {
      assets: [...(current.assets ?? []), ...savedAssets],
      brand: requestedPurpose === "logo" ? { ...current.brand, logoAssetId: savedAssets[0]?.id } : current.brand
    });
    return NextResponse.json({ ok: true, assets: savedAssets, project });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Asset upload failed." },
      { status: 500 }
    );
  }
}
