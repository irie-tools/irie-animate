import { notFound } from "next/navigation";
import { projectExists } from "@/src/lib/projectStore";

type Props = { params: Promise<{ projectId: string }> };

export default async function PreviewPage({ params }: Props) {
  const { projectId } = await params;
  if (!projectExists(projectId)) notFound();
  return <main style={{ margin: 0, background: "#050505", minHeight: "100vh" }}>
    <iframe title="Animated site preview" src={`/api/projects/${encodeURIComponent(projectId)}/export/index.html`} style={{ width: "100%", height: "100vh", border: 0, display: "block" }} />
  </main>;
}
