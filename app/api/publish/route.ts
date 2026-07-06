import { NextResponse } from "next/server";
import { exportStaticSite } from "@/src/lib/exportSite";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await exportStaticSite("irie-demo");
    return NextResponse.json({
      ok: true,
      status: "fallback_ready",
      reason: "vercel_not_connected",
      message: `Vercel is not connected here, so I prepared a static export at ${result.outputDir}.`,
      manualCommands: ["npm run verify", "cd exports/irie-demo-animated-site", "npx vercel deploy"]
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Publish fallback failed." },
      { status: 500 }
    );
  }
}
