import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { safeProjectId } from "@/src/lib/projectStore";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string; path: string[] }> };

export async function GET(_: Request, { params }: Params) {
  const { projectId, path } = await params;
  const root = resolve(process.cwd(), "exports", `${safeProjectId(projectId)}-animated-site`);
  const filePath = resolve(root, ...path);
  if (!filePath.startsWith(`${root}${sep}`) || !existsSync(filePath)) return NextResponse.json({ error: "Export file not found." }, { status: 404 });
  const bytes = await readFile(filePath);
  return new Response(bytes, { headers: { "Content-Type": contentType(extname(filePath)), "Cache-Control": "no-store" } });
}

function contentType(extension: string) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".md": "text/markdown; charset=utf-8" } as Record<string, string>)[extension] || "application/octet-stream";
}
