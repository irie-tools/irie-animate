import { NextResponse } from "next/server";
import { createProject, projectExists, safeProjectId } from "@/src/lib/projectStore";
import { importWebsite } from "@/src/lib/storefrontIntake";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url : "";
    if (!url.trim()) return NextResponse.json({ ok: false, error: "Enter a website URL." }, { status: 400 });
    const intake = await importWebsite(url);
    const baseId = safeProjectId(intake.brandName);
    const projectId = projectExists(baseId) ? `${baseId}-${Date.now().toString(36).slice(-5)}` : baseId;
    const project = await createProject({ id: projectId, name: intake.brandName, intake });
    return NextResponse.json({ ok: true, project, intake });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Website analysis failed." }, { status: 500 });
  }
}
