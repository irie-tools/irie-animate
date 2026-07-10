import Link from "next/link";
import { notFound } from "next/navigation";
import { projectExists } from "@/src/lib/projectStore";

type Props = { params: Promise<{ projectId: string }> };

export default async function PreviewPage({ params }: Props) {
  const { projectId } = await params;
  if (!projectExists(projectId)) notFound();
  return <main style={{ margin: 0, background: "#050505", minHeight: "100vh" }}>
    <div style={{ position: "fixed", zIndex: 100, right: 14, top: 14, display: "flex", gap: 8 }}>
      <Link href={`/studio?projectId=${projectId}`} style={{ background: "#ffd51f", color: "#111", padding: "11px 14px", textDecoration: "none", font: "800 11px Arial", textTransform: "uppercase", letterSpacing: ".12em" }}>Open Studio</Link>
    </div>
    <iframe title="Animated site preview" src={`/api/projects/${encodeURIComponent(projectId)}/export/index.html`} style={{ width: "100%", height: "100vh", border: 0, display: "block" }} />
  </main>;
}
