import { NextResponse } from "next/server";
import { cookProjectFrames } from "@/src/lib/projectPipeline";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await cookProjectFrames();
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
