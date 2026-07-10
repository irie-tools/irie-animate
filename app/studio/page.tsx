import { IrieAnimateApp } from "@/src/components/IrieAnimateApp";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  return <IrieAnimateApp initialProjectId={projectId || "irie-demo"} />;
}
