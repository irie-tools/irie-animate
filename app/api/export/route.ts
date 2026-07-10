import { NextResponse } from "next/server";
import { exportStaticSite } from "@/src/lib/exportSite";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await exportStaticSite(typeof body.projectId === "string" ? body.projectId : "irie-demo");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Export failed." },
      { status: 500 }
    );
  }
}
