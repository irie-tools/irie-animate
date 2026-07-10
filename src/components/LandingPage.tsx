import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Link from "next/link";
import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { readTenant } from "@/src/lib/tenantStore";
import { readProject } from "@/src/lib/projectStore";
import { analyzeProject } from "@/src/lib/projectBrain";
import type { FramesManifest } from "@/src/lib/types";
import styles from "./SaasShell.module.css";

export async function LandingPage() {
  const [tenant, project] = await Promise.all([readTenant(), readProject()]);
  const manifest = await readManifest(project.brandId);
  const brain = analyzeProject(project, manifest);

  return (
    <main className={styles.siteShell}>
      <nav className={styles.topNav} aria-label="Primary">
        <Link className={styles.mark} href="/">
          <i />
          <strong>IRIE ANIMATE</strong>
        </Link>
        <div className={styles.navLinks}>
          <a href="#how">How it works</a>
          <Link href="/admin">Tenant Admin</Link>
          <Link className={styles.primaryLink} href="/create">Create a site <ArrowRight size={15} /></Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>Build scroll-driven brand sites from real motion assets.</h1>
          <p>
            Irie Animate is a tenant-ready website builder for staging brand kits, mapping source clips to scenes,
            cooking optimized frame sequences, and exporting scroll-driven animated sites.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryLink} href="/create"><Sparkles size={15} /> Start with a storefront</Link>
            <Link className={styles.secondaryLink} href="/admin"><KeyRound size={15} /> Admin back door</Link>
          </div>
          <div className={styles.proofStrip}>
            <span><strong>{tenant.workspaceName}</strong> Active tenant</span>
            <span><strong>{brain.stats.renderedFrames || 194}</strong> Cooked frames</span>
            <span><strong>{tenant.plan}</strong> Plan mode</span>
          </div>
        </div>

        <div className={styles.previewFrame} aria-label="Irie Animate product preview">
          <div className={styles.previewChrome}><i /><i /><i /><span>{tenant.slug}.irieanimate.local</span></div>
          <div className={styles.previewImage}>
            <div className={styles.previewOverlay}>
              <div>
                <span>Studio preview</span>
                <strong>{project.name}</strong>
              </div>
              <span className={styles.miniMetric}><b>{brain.score}%</b> Brain score</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="how">
        <div className={styles.sectionHeader}>
          <h2>How to use it</h2>
          <p>The product path is intentionally simple: bring in source truth, map scenes, cook frames, check the brain, then export.</p>
        </div>
        <div className={styles.workflowGrid}>
          {[
            ["01", "Set the tenant", "Use Admin to name the workspace, owner, plan, limits, feature flags, and onboarding gates."],
            ["02", "Load brand assets", "Open Studio, upload logo/reference files, and add MP4/MOV clips as source assets."],
            ["03", "Map scenes", "Use the Scenes panel to assign each site scene to a frame scene and optional source video."],
            ["04", "Cook and ship", "Run Cook Frames, review Project Brain blockers, then prepare a static export package."]
          ].map(([number, title, body]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Controls that make it SaaS-shaped</h2>
          <p>The app now has a front door, a studio, and a tenant back door backed by local APIs.</p>
        </div>
        <div className={styles.guidePanel}>
          <ol>
            <li>Use `/` as the public product front door for clients or operators.</li>
            <li>Use `/studio` for the actual animation builder and frame pipeline.</li>
            <li>Use `/admin` to manage the active tenant, feature flags, usage limits, and onboarding state.</li>
          </ol>
          <div className={styles.controlList}>
            <div><strong>Tenant identity</strong><span>Workspace, owner, initials, plan, domain</span></div>
            <div><strong>Feature flags</strong><span>Video cook, exports, public front door, approval gate</span></div>
            <div><strong>Usage limits</strong><span>Project count, source minutes, monthly exports</span></div>
            <div><strong>Operational brain</strong><span>Readiness score, blockers, next actions</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}

async function readManifest(brandId: string): Promise<FramesManifest | null> {
  const manifestPath = resolve(process.cwd(), "public", "frames", brandId, "frames.manifest.json");
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(await readFile(manifestPath, "utf8")) as FramesManifest;
}
