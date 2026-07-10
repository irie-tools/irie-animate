import { NextResponse } from "next/server";
import { createProject, listProjects, safeProjectId } from "@/src/lib/projectStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, projects: await listProjects() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "Project name is required." }, { status: 400 });
    const project = await createProject({ id: safeProjectId(body.id || name), name });
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Project creation failed." }, { status: 400 });
  }
}
