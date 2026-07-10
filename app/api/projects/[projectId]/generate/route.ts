import { NextResponse } from "next/server";
import { generateExperience } from "@/src/lib/experienceGenerator";
import { projectExists, type MotionRecipe } from "@/src/lib/projectStore";

export const runtime = "nodejs";
export const maxDuration = 180;

type Params = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    if (!projectExists(projectId)) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const result = await generateExperience(projectId, body.recipe as Partial<MotionRecipe> | undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Generation failed." }, { status: 500 });
  }
}
