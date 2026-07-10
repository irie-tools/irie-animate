import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { projectExists, readProject } from "@/src/lib/projectStore";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ projectId: string; assetId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { projectId, assetId } = await params;
  if (!projectExists(projectId)) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const project = await readProject(projectId);
  const asset = project.assets.find((item) => item.id === assetId);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  const bytes = await readFile(asset.path);
  return new Response(bytes, {
    headers: {
      "Content-Type": asset.type || "application/octet-stream",
      "Cache-Control": "no-store"
    }
  });
}
