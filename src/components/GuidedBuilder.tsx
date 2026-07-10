"use client";

import Link from "next/link";
import { Check, Download, ExternalLink, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { EditorProject, MotionIntensity, StorefrontIntake } from "@/src/lib/projectStore";
import styles from "./GuidedBuilder.module.css";

const motionOptions: Array<{ value: MotionIntensity; label: string; description: string }> = [
  { value: "calm", label: "Subtle", description: "Slower movement and fewer frames" },
  { value: "loud", label: "Bold", description: "More color, scale, and movement" },
  { value: "unhinged", label: "Extreme", description: "Fastest and most animated" }
];

export function GuidedBuilder() {
  const [url, setUrl] = useState("");
  const [project, setProject] = useState<EditorProject | null>(null);
  const [intake, setIntake] = useState<StorefrontIntake | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<MotionIntensity>("loud");
  const [busy, setBusy] = useState<"import" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleProducts = useMemo(() => intake?.products.filter((product) => !failedImages.includes(product.id)).slice(0, 18) ?? [], [failedImages, intake]);

  async function importSite() {
    if (!url.trim()) return;
    setBusy("import");
    setError(null);
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not import that storefront.");
      setProject(payload.project);
      setIntake(payload.intake);
      setFailedImages([]);
      setSelected(payload.intake.products.slice(0, 6).map((product: { id: string }) => product.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import that storefront.");
    } finally {
      setBusy(null);
    }
  }

  function toggleProduct(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 6 ? [...current, id] : current);
  }

  function removeBrokenProduct(id: string) {
    setFailedImages((current) => current.includes(id) ? current : [...current, id]);
    setSelected((current) => current.filter((item) => item !== id));
  }

  async function generate() {
    if (!project) return;
    setBusy("generate");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: {
            intensity,
            selectedProductIds: selected,
            heroDuration: intensity === "calm" ? 12 : intensity === "loud" ? 10 : 8,
            frameCount: intensity === "calm" ? 72 : intensity === "loud" ? 84 : 96,
            palette: intake?.palette
          }
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not generate the site.");
      setProject(payload.project);
      setReady(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate the site.");
    } finally {
      setBusy(null);
    }
  }

  function startOver() {
    setProject(null);
    setIntake(null);
    setSelected([]);
    setFailedImages([]);
    setReady(false);
    setError(null);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <strong>IRIE ANIMATE</strong>
        <span>Storefront to animated site</span>
      </header>

      <div className={styles.content}>
        {!project && (
          <section className={styles.start}>
            <h1>Enter your storefront.</h1>
            <p>We’ll pull in the products and build an animated version you can preview and download.</p>
            <form onSubmit={(event) => { event.preventDefault(); void importSite(); }}>
              <label htmlFor="storefront-url">Storefront URL</label>
              <div className={styles.urlRow}>
                <input id="storefront-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://yourstore.com" inputMode="url" autoFocus />
                <button type="submit" disabled={!url.trim() || Boolean(busy)}>
                  {busy === "import" && <LoaderCircle className={styles.spin} />}
                  {busy === "import" ? "Importing" : "Continue"}
                </button>
              </div>
            </form>
          </section>
        )}

        {project && !ready && (
          <div className={styles.setup}>
            <section>
              <div className={styles.sectionHeading}>
                <div><span>1</span><h2>Choose products</h2></div>
                <p>{selected.length} of 6 selected</p>
              </div>
              <div className={styles.products}>
                {visibleProducts.map((product) => (
                  <button type="button" className={selectedSet.has(product.id) ? styles.selected : ""} onClick={() => toggleProduct(product.id)} key={product.id}>
                    <div><img src={product.imageUrl} alt={product.name} onError={() => removeBrokenProduct(product.id)} />{selectedSet.has(product.id) && <i><Check /></i>}</div>
                    <strong>{product.name}</strong>
                    <span>{product.price || "Product"}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.motionSection}>
              <div className={styles.sectionHeading}><div><span>2</span><h2>Choose motion</h2></div></div>
              <div className={styles.motionOptions}>
                {motionOptions.map((option) => (
                  <button type="button" key={option.value} className={intensity === option.value ? styles.activeMotion : ""} onClick={() => setIntensity(option.value)}>
                    <strong>{option.label}</strong><span>{option.description}</span>
                  </button>
                ))}
              </div>
              <button className={styles.generate} onClick={generate} disabled={!selected.length || Boolean(busy)}>
                {busy === "generate" && <LoaderCircle className={styles.spin} />}
                {busy === "generate" ? "Building your site…" : "Build animated site"}
              </button>
              {busy === "generate" && <p className={styles.waitNote}>This usually takes about a minute.</p>}
            </section>
          </div>
        )}

        {ready && project && (
          <section className={styles.done}>
            <div className={styles.doneMark}><Check /></div>
            <h1>Your site is ready.</h1>
            <p>Preview it, download the complete site, or start another one.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href={`/preview/${project.id}`} target="_blank">Preview site <ExternalLink /></Link>
              <a className={styles.secondaryAction} href={`/api/projects/${encodeURIComponent(project.id)}/download`}>Download site <Download /></a>
              <button type="button" onClick={startOver}>Start another</button>
            </div>
          </section>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
