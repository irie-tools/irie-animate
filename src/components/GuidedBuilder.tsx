"use client";

import Link from "next/link";
import { Check, Download, ExternalLink, Film, ImageOff, LoaderCircle, Search, ShoppingBag, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { EditorProject, MotionIntensity, WebsiteIntake } from "@/src/lib/projectStore";
import styles from "./GuidedBuilder.module.css";

const motionOptions: Array<{ value: MotionIntensity; label: string; description: string }> = [
  { value: "calm", label: "Cinematic", description: "Long dissolves and restrained camera movement" },
  { value: "loud", label: "Dynamic", description: "Image sequencing, color shifts, and confident motion" },
  { value: "unhinged", label: "Experimental", description: "Fast cuts, deeper zooms, and graphic pulses" }
];

export function GuidedBuilder() {
  const [url, setUrl] = useState("");
  const [project, setProject] = useState<EditorProject | null>(null);
  const [intake, setIntake] = useState<WebsiteIntake | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<MotionIntensity>("loud");
  const [busy, setBusy] = useState<"import" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [motionProof, setMotionProof] = useState<{ imageCount: number; localVideo: boolean; apiCalls: number } | null>(null);
  const sectionSet = useMemo(() => new Set(selectedSections), [selectedSections]);
  const productSet = useMemo(() => new Set(selectedProducts), [selectedProducts]);
  const failedImageSet = useMemo(() => new Set(failedImages), [failedImages]);
  const currentStep = ready || busy === "generate" ? 4 : project ? 2 : 1;

  async function analyzeWebsite() {
    if (!url.trim()) return;
    setBusy("import");
    setError(null);
    try {
      const response = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not analyze that website.");
      const nextIntake = payload.intake as WebsiteIntake;
      setProject(payload.project);
      setIntake(nextIntake);
      setFailedImages([]);
      setSelectedSections(nextIntake.sections.slice(0, 6).map((section) => section.id));
      setSelectedProducts(nextIntake.hasCommerce ? nextIntake.products.slice(0, 6).map((product) => product.id) : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not analyze that website.");
    } finally {
      setBusy(null);
    }
  }

  function toggleSection(id: string) {
    setSelectedSections((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 6 ? [...current, id] : current);
  }

  function toggleProduct(id: string) {
    setSelectedProducts((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 6 ? [...current, id] : current);
  }

  async function generate() {
    if (!project || !intake) return;
    setBusy("generate");
    setError(null);
    try {
      const sectionImages = intake.sections.filter((section) => selectedSections.includes(section.id)).flatMap((section) => section.imageUrls);
      const selectedMediaIds = intake.media.filter((media) => sectionImages.includes(media.url)).map((media) => media.id);
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: {
          intensity,
          selectedSectionIds: selectedSections,
          selectedMediaIds: selectedMediaIds.length ? selectedMediaIds.slice(0, 8) : intake.media.slice(0, 8).map((media) => media.id),
          selectedProductIds: selectedProducts,
          heroDuration: intensity === "calm" ? 14 : intensity === "loud" ? 10 : 8,
          frameCount: intensity === "calm" ? 72 : intensity === "loud" ? 84 : 96,
          palette: intake.palette,
          chapters: intake.sections.filter((section) => selectedSections.includes(section.id)).map((section) => section.title)
        } })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not generate the website.");
      setProject(payload.project);
      setMotionProof(payload.motion);
      setReady(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate the website.");
    } finally {
      setBusy(null);
    }
  }

  function startOver() {
    setProject(null);
    setIntake(null);
    setSelectedSections([]);
    setSelectedProducts([]);
    setFailedImages([]);
    setMotionProof(null);
    setReady(false);
    setError(null);
  }

  return <main className={styles.shell}>
    <header className={styles.header}><strong>IRIE ANIMATE</strong><span>Any website → cinematic motion</span></header>
    <div className={styles.content}>
      <nav className={styles.progress} aria-label="Build progress">
        {["Analyze website", "Choose sections", "Create local motion", "Preview & download"].map((label, index) => {
          const step = index + 1;
          const complete = step < currentStep;
          const active = step === currentStep;
          return <div key={label} className={active ? styles.progressActive : complete ? styles.progressComplete : ""}><span>{complete ? <Check /> : step}</span><strong>{label}</strong></div>;
        })}
      </nav>

      {!project && <section className={styles.start}>
        <h1>Transform a website.</h1>
        <p>Enter any public website. Irie Animate reads its pages, sections, copy, images, and actions, then builds a cinematic replacement locally.</p>
        <form onSubmit={(event) => { event.preventDefault(); void analyzeWebsite(); }} data-mcp-action="analyze-website" data-mcp-description="Analyze a public website for local animated transformation">
          <label htmlFor="website-url">Website URL</label>
          <div className={styles.urlRow}><input id="website-url" name="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" inputMode="url" autoFocus data-mcp-param="url"/><button type="submit" disabled={!url.trim() || Boolean(busy)}>{busy === "import" && <LoaderCircle className={styles.spin}/>} {busy === "import" ? "Analyzing website…" : "Analyze website"}</button></div>
        </form>
        <div className={styles.capabilityStrip}><span><Film/> Images → local MP4</span><span><Sparkles/> Cinematic scroll motion</span><span><Search/> SEO + answer-ready output</span></div>
      </section>}

      {project && intake && !ready && <div className={styles.setup}>
        <div className={styles.importedStore}><div><span>Analyzed website</span><strong>{intake.brandName}</strong><small>{intake.siteKind} · {intake.pages.length} pages · {intake.media.length} images{intake.hasCommerce ? " · shop detected" : ""}</small></div><button type="button" onClick={startOver}>Change website</button></div>

        <section><div className={styles.sectionHeading}><div><span>2</span><h2>Choose sections</h2></div><p>{selectedSections.length} of 6 selected</p></div>
          <div className={styles.sectionGrid}>{intake.sections.slice(0, 18).map((section, index) => {
            const imageUrl = section.imageUrls[0] || intake.media[index % Math.max(1, intake.media.length)]?.url;
            const imageFailed = imageUrl ? failedImageSet.has(imageUrl) : true;
            return <button type="button" className={sectionSet.has(section.id) ? styles.selected : ""} onClick={() => toggleSection(section.id)} key={section.id}>
              <div className={styles.sectionMedia}>{imageUrl && !imageFailed ? <img src={imageUrl} alt="" onError={() => setFailedImages((current) => current.includes(imageUrl) ? current : [...current, imageUrl])}/> : <span><ImageOff/><small>{section.kind}</small></span>}{sectionSet.has(section.id) && <i><Check/></i>}</div>
              <span className={styles.kind}>{section.kind}</span><strong>{section.heading}</strong><p>{section.summary}</p>
            </button>;
          })}</div>
        </section>

        {intake.hasCommerce && intake.products.length > 0 && <details className={styles.commerceOptions}><summary><span><ShoppingBag/> Shop detected</span><small>Optional: choose products to restyle inside the generated website</small></summary><div className={styles.products}>{intake.products.slice(0, 12).map((product) => <button type="button" className={productSet.has(product.id) ? styles.selected : ""} onClick={() => toggleProduct(product.id)} key={product.id}><img src={product.imageUrl} alt={product.name}/><strong>{product.name}</strong><span>{product.price}</span>{productSet.has(product.id) && <i><Check/></i>}</button>)}</div></details>}

        <section className={styles.motionSection}><div className={styles.sectionHeading}><div><span>3</span><h2>Choose motion</h2></div></div><div className={styles.motionOptions}>{motionOptions.map((option) => <button type="button" key={option.value} className={intensity === option.value ? styles.activeMotion : ""} onClick={() => setIntensity(option.value)}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div>
          <div className={styles.included}><strong>Included automatically</strong><span>Local image-sequenced MP4</span><span>Scroll-scrub WebP frames</span><span>Metadata + JSON-LD</span><span>FAQ + llms.txt</span><span>robots.txt + sitemap</span><span>Agent action manifest</span></div>
          <button className={styles.generate} onClick={generate} disabled={!selectedSections.length || Boolean(busy)}>{busy === "generate" && <LoaderCircle className={styles.spin}/>} {busy === "generate" ? "Piecing images into motion…" : "Build animated website"}</button>{busy === "generate" && <p className={styles.waitNote}>No Higgsfield or animation API. Your Mac is building the film, frames, website, and search package locally.</p>}
        </section>
      </div>}

      {ready && project && <section className={styles.done}><div className={styles.doneMark}><Check/></div><h1>Your animated website is ready.</h1><p>{motionProof ? `Built locally from ${motionProof.imageCount} images with ${motionProof.apiCalls} animation API calls.` : "Built locally from the website’s own images."}</p><div className={styles.actions}><Link className={styles.primaryAction} href={`/preview/${project.id}`} target="_blank">Preview in iframe <ExternalLink/></Link><a className={styles.secondaryAction} href={`/api/projects/${encodeURIComponent(project.id)}/download`}>Download website <Download/></a><button type="button" onClick={startOver}>Transform another</button></div></section>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  </main>;
}
