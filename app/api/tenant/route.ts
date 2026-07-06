import { NextResponse } from "next/server";
import { readTenant, updateTenant } from "@/src/lib/tenantStore";

export const runtime = "nodejs";

export async function GET() {
  const tenant = await readTenant();
  return NextResponse.json({ ok: true, tenant });
}

export async function PATCH(request: Request) {
  try {
    const patch = await request.json();
    const tenant = await updateTenant(patch);
    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Tenant update failed." },
      { status: 500 }
    );
  }
}
