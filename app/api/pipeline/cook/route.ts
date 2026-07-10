import { NextResponse } from "next/server";
import { cookProjectFrames } from "@/src/lib/projectPipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = typeof body.projectId === "string" ? body.projectId : "irie-demo";
    const result = await cookProjectFrames(projectId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Pipeline failed."
      },
      { status: 500 }
    );
  }
}
