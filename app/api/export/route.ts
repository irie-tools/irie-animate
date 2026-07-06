import { NextResponse } from "next/server";
import { exportStaticSite } from "@/src/lib/exportSite";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await exportStaticSite("irie-demo");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Export failed." },
      { status: 500 }
    );
  }
}
