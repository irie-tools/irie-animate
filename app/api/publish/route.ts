import { NextResponse } from "next/server";
import { exportStaticSite } from "@/src/lib/exportSite";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = typeof body.projectId === "string" ? body.projectId : "irie-demo";
    const result = await exportStaticSite(projectId);
    return NextResponse.json({
      ok: true,
      status: "fallback_ready",
      reason: "vercel_not_connected",
      message: `Vercel is not connected here, so I prepared a static export at ${result.outputDir}.`,
      manualCommands: ["npm run verify", `cd exports/${projectId}-animated-site`, "npx vercel deploy"]
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Publish fallback failed." },
      { status: 500 }
    );
  }
}
