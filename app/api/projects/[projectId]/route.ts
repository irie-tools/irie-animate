import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { projectExists, readProject, updateProject } from "@/src/lib/projectStore";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!projectExists(projectId)) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const project = await readProject(projectId);
  const manifestPath = resolve(process.cwd(), "public", "frames", project.brandId, "frames.manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : null;

  return NextResponse.json({ ok: true, project, manifest });
}

export async function PATCH(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!projectExists(projectId)) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const patch = await request.json();
  const project = await updateProject(projectId, patch);
  return NextResponse.json({ ok: true, project });
}
