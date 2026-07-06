import { NextResponse } from "next/server";
import { readProject } from "@/src/lib/projectStore";

export const runtime = "nodejs";

export async function GET() {
  const project = await readProject();
  return NextResponse.json({
    ok: true,
    projects: [
      {
        id: project.id,
        name: project.name,
        brandId: project.brandId,
        status: "ready",
        updatedAt: project.updatedAt
      }
    ]
  });
}
