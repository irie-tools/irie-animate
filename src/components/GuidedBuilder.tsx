"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { EditorProject, MotionIntensity, StorefrontIntake } from "@/src/lib/projectStore";
import styles from "./GuidedBuilder.module.css";

export function GuidedBuilder() {
  const [url, setUrl] = useState("https://irieswag.com/");
  const [project, setProject] = useState<EditorProject | null>(null);
  const [intake, setIntake] = useState<StorefrontIntake | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<MotionIntensity>("unhinged");
  const [busy, setBusy] = useState<"import" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const step = ready ? 4 : project ? 2 : 1;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  async function importSite() {
    setBusy("import"); setError(null);
    try {
      const response = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Import failed.");
      setProject(payload.project); setIntake(payload.intake);
      setSelected(payload.intake.products.slice(0, 6).map((product: { id: string }) => product.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Import failed."); }
    finally { setBusy(null); }
  }

  function toggleProduct(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 6 ? [...current, id] : current);
  }

  async function generate() {
    if (!project) return;
    setBusy("generate"); setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: { intensity, selectedProductIds: selected, heroDuration: intensity === "calm" ? 12 : intensity === "loud" ? 10 : 8, frameCount: intensity === "calm" ? 72 : intensity === "loud" ? 84 : 96, palette: intake?.palette } })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Generation failed.");
      setProject(payload.project); setReady(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Generation failed."); }
    finally { setBusy(null); }
  }

  return <main className={styles.shell}>
    <nav><Link href="/"><ArrowLeft size={16}/> IRIE ANIMATE</Link><span>Storefront film machine</span></nav>
    <header><span className={styles.kicker}><WandSparkles size={16}/> URL in. Wild site out.</span><h1>Make the shop<br/><i>move<br/><span style={{ fontSize: ".72em" }}>different.</span></i></h1><p>Paste a storefront, pick the products, choose how far to push it. Irie Animate builds the motion frames, hero film, mobile version, and static site.</p></header>
    <div className={styles.steps}>{["Import", "Direct", "Generate", "Preview"].map((label, index) => <div className={index + 1 <= step ? styles.active : ""} key={label}><b>{index + 1 < step ? <Check size={14}/> : `0${index + 1}`}</b>{label}</div>)}</div>
    {!project && <section className={styles.panel}><label>Storefront URL</label><div className={styles.urlRow}><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://yourstore.com"/><button onClick={importSite} disabled={Boolean(busy)}>{busy === "import" ? <LoaderCircle className={styles.spin}/> : <ArrowRight/>} Pull it in</button></div><small>We read public brand copy, colors, product images, prices, and links. Nothing gets published.</small></section>}
    {project && !ready && <>
      <section className={styles.panel}><div className={styles.panelHead}><div><label>Pick the stars</label><h2>{intake?.brandName}</h2></div><span>{selected.length}/6 selected</span></div><div className={styles.products}>{intake?.products.slice(0, 18).map((product) => <button type="button" className={selectedSet.has(product.id) ? styles.selected : ""} onClick={() => toggleProduct(product.id)} key={product.id}><img src={product.imageUrl} alt=""/><i>{selectedSet.has(product.id) && <Check/>}</i><strong>{product.name}</strong><span>{product.price || "Product"}</span></button>)}</div></section>
      <section className={`${styles.panel} ${styles.direction}`}><div><label>Motion direction</label><h2>How weird are we getting?</h2></div><div className={styles.modes}>{(["calm", "loud", "unhinged"] as MotionIntensity[]).map((mode) => <button key={mode} className={intensity === mode ? styles.selectedMode : ""} onClick={() => setIntensity(mode)}><b>{mode}</b><span>{mode === "calm" ? "Editorial drift" : mode === "loud" ? "Color, scale, snap" : "Full-volume beautiful chaos"}</span></button>)}</div><button className={styles.generate} onClick={generate} disabled={!selected.length || Boolean(busy)}>{busy === "generate" ? <><LoaderCircle className={styles.spin}/> Cooking frames and film…</> : <><Sparkles/> Generate the experience</>}</button><small>This can take a minute. The app is making real desktop and mobile assets.</small></section>
    </>}
    {ready && project && <section className={`${styles.panel} ${styles.done}`}><span><Sparkles/> Experience cooked</span><h2>{project.name} has a new frequency.</h2><p>The animated site, mobile frames, hero film, and product links are packaged. Open the preview, then fine-tune it in the full studio if you want to get surgical.</p><div><Link className={styles.previewButton} href={`/preview/${project.id}`} target="_blank">Open animated preview <ArrowRight/></Link><Link className={styles.studioButton} href={`/studio?projectId=${project.id}`}>Fine-tune in Studio</Link></div></section>}
    {error && <p className={styles.error}>{error}</p>}
  </main>;
}
