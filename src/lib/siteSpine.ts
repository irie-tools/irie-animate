// site.spine.v1 — the Irie Builder House shared editable-document format.
// Emitted by Irie Animate on export ALONGSIDE the standalone index.html so the
// animated site can be re-opened and edited in the Irie Builder editor.
//
// These types are copied locally on purpose. Do NOT import them across repos —
// the canonical definition lives in irie-builder (lib/site-spine); this file is
// the Animate-side mirror plus a builder + a zero-dependency validator.

import type { EditorProject } from "./projectStore";
import type { FramesManifest } from "./types";

/* ------------------------------------------------------------------ *
 * site.spine.v1 types (mirror of irie-builder lib/site-spine/types.ts)
 * ------------------------------------------------------------------ */

export type SpineSource = "builder-generate" | "import" | "animate";

export type SpineBlockType =
  | "hero"
  | "text-media"
  | "cards"
  | "proof"
  | "cta"
  | "faq"
  | "commerce"
  | "imported"
  | "video-hero"
  | "scroll-sequence";

export interface SpineMedia {
  kind: "image" | "product";
  src: string;
  alt?: string;
  href?: string;
  price?: string;
}

export interface MotionAnchor {
  dwellIndex: number;
}

export interface MotionBundleRef {
  engine: "irie-animate";
  frames: { desktop: string; mobile: string; count: number; pattern: string };
  video: { desktop: string; mobile: string; poster: string };
  intensity: "calm" | "loud" | "unhinged";
  recook: { frameCount: number; sourceImageSetHash: string };
}

export interface SpineShell {
  renderTemplate: string;
  designContract: unknown | null;
  palette: { primary: string; accent: string; background: string };
}

export interface SpineSection {
  id: string;
  kind: string;
  block: SpineBlockType;
  locked?: boolean;
  content: Record<string, string>;
  media?: SpineMedia[];
  motionRef?: MotionAnchor;
  html?: string;
  tunerState?: Record<string, number | string>;
}

export interface SpineMeta {
  brief?: Record<string, unknown>;
  referenceId?: string;
  sourceUrl?: string;
  animateProjectId?: string;
  platform: "irie-builder";
}

export interface SiteSpine {
  version: "site.spine.v1";
  source: SpineSource;
  shell: SpineShell;
  sections: SpineSection[];
  motion?: MotionBundleRef;
  meta: SpineMeta;
}

export const SECTION_ANCHOR = "<!-- irie-spine-sections -->";

/* ------------------------------------------------------------------ *
 * Builder — buildSiteSpine(project, manifest, assetUrls)
 *
 * Same parameters exportSite's buildStaticHtml receives, so it reads as a
 * clean parallel to the standalone-HTML emitter.
 * ------------------------------------------------------------------ */

export function buildSiteSpine(
  project: EditorProject,
  manifest: FramesManifest,
  assetUrls: Map<string, string>
): SiteSpine {
  const intake = project.intake;
  if (!intake) throw new Error("Missing website analysis.");

  const recipe = project.recipe;

  // Palette: recipe palette preferred, then intake palette; map first three to
  // primary/accent/background with sensible fallbacks.
  const colors = recipe?.palette?.length ? recipe.palette : intake.palette;
  const palette = {
    primary: colors[0] || "#0a0a08",
    accent: colors[1] || "#c89848",
    background: colors[2] || "#f3eedf",
  };

  // Motion / frame geometry — mirror buildStaticHtml's resolution exactly.
  const hero = manifest.scenes.find((scene) => scene.target === "hero") ?? manifest.scenes[0];
  const heroId = hero?.id || "hero";
  const frameCount = hero?.frameCount || 1;
  const framePattern = hero?.framePattern || `/frames/${project.brandId}/${heroId}/desktop/frame-{index}.webp`;
  const framesDesktop = `./public/frames/${project.brandId}/${heroId}/desktop`;
  const framesMobile = `./public/frames/${project.brandId}/${heroId}/mobile`;
  const frameBase = `./public/frames/${project.brandId}/${heroId}`;

  // Video / poster asset urls — same lookups buildStaticHtml performs.
  const heroVideo = project.generated?.heroVideoAssetId ? assetUrls.get(project.generated.heroVideoAssetId) : undefined;
  const mobileVideo = project.generated?.mobileVideoAssetId ? assetUrls.get(project.generated.mobileVideoAssetId) : heroVideo;
  const posterAsset = project.generated?.posterAssetId ? assetUrls.get(project.generated.posterAssetId) : undefined;
  const posterFallback = `${frameBase}/desktop/frame-0001.webp`;
  const videoDesktop = heroVideo || posterFallback;
  const videoMobile = mobileVideo || videoDesktop;
  const poster = posterAsset || posterFallback;

  const intensity = recipe?.intensity ?? "loud";

  const motion: MotionBundleRef = {
    engine: "irie-animate",
    frames: { desktop: framesDesktop, mobile: framesMobile, count: frameCount, pattern: framePattern },
    video: { desktop: videoDesktop, mobile: videoMobile, poster },
    intensity,
    recook: {
      frameCount,
      sourceImageSetHash: sourceImageSetHash(project),
    },
  };

  const usedIds = new Set<string>();
  const claimId = (preferred: string): string => {
    let id = preferred;
    let suffix = 2;
    while (usedIds.has(id)) id = `${preferred}-${suffix++}`;
    usedIds.add(id);
    return id;
  };

  // 1) Locked video-hero.
  const heroSectionId = claimId("video-hero");
  const headline = intake.headline || intake.brandName;
  const body = intake.description || intake.answer?.summary || "";
  const videoHero: SpineSection = {
    id: heroSectionId,
    kind: "video-hero",
    block: "video-hero",
    locked: true,
    content: { headline, body },
    motionRef: { dwellIndex: 0 },
    html:
      `<section data-irie-section-id="${heroSectionId}" class="irie-video-hero">` +
      `<video autoplay muted loop playsinline poster="${escapeAttr(poster)}">` +
      `<source media="(max-width:760px)" src="${escapeAttr(videoMobile)}" type="video/mp4">` +
      `<source src="${escapeAttr(videoDesktop)}" type="video/mp4"></video>` +
      `<div class="irie-video-hero-overlay"><h1>${escapeHtml(headline)}</h1></div>` +
      `</section>`,
  };

  // 2) Locked scroll-sequence.
  const scrollSectionId = claimId("scroll-images");
  const scrollSequence: SpineSection = {
    id: scrollSectionId,
    kind: "scroll-sequence",
    block: "scroll-sequence",
    locked: true,
    content: {},
    motionRef: { dwellIndex: 1 },
    html:
      `<section data-irie-section-id="${scrollSectionId}" class="irie-scroll-sequence" ` +
      `data-frames="${escapeAttr(framesDesktop)}" data-frames-mobile="${escapeAttr(framesMobile)}" ` +
      `data-frame-count="${frameCount}" data-frame-pattern="${escapeAttr(framePattern)}">` +
      `<canvas></canvas></section>`,
  };

  // 3) Editable content sections, in recipe.selectedSectionIds order.
  const sectionsById = new Map(intake.sections.map((section) => [section.id, section] as const));
  const orderedIds = recipe?.selectedSectionIds?.length
    ? recipe.selectedSectionIds
    : intake.sections.slice(0, 6).map((section) => section.id);
  const contentSections: SpineSection[] = orderedIds
    .map((id) => sectionsById.get(id))
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
    .map((section) => {
      const id = claimId(section.id);
      const secHeadline = section.heading || section.title;
      const secBody = section.summary || section.body || "";
      return {
        id,
        kind: section.kind,
        block: section.kind === "commerce" ? "commerce" : "text-media",
        content: { headline: secHeadline, body: secBody },
        html:
          `<section data-irie-section-id="${id}"><h2>${escapeHtml(secHeadline)}</h2>` +
          `<p>${escapeHtml(secBody)}</p></section>`,
      } satisfies SpineSection;
    });

  const sections: SpineSection[] = [videoHero, scrollSequence, ...contentSections];

  // 4) Optional commerce section from products (selected first, else all).
  const selectedProducts = recipe?.selectedProductIds?.length
    ? intake.products.filter((product) => recipe.selectedProductIds.includes(product.id)).slice(0, 6)
    : intake.products.slice(0, 6);
  if (selectedProducts.length) {
    const commerceId = claimId("commerce");
    const commerceHeadline = "Shop the collection";
    sections.push({
      id: commerceId,
      kind: "commerce",
      block: "commerce",
      content: { headline: commerceHeadline },
      media: selectedProducts.map((product) => {
        const image = product.assetId ? assetUrls.get(product.assetId) : undefined;
        return {
          kind: "product" as const,
          src: image || product.imageUrl,
          alt: product.name,
          href: product.purchaseUrl,
          price: product.price || "",
        };
      }),
      html: `<section data-irie-section-id="${commerceId}"><h2>${escapeHtml(commerceHeadline)}</h2></section>`,
    });
  }

  const title = intake.seo?.sourceTitle || `${intake.brandName} | ${headline}`;

  return {
    version: "site.spine.v1",
    source: "animate",
    shell: {
      // v1 minimal-but-valid shell: correct <head> + a body whose sole content
      // is the section anchor. See report note — the standalone canvas-engine
      // script targets DOM (.animation-section/.scroll-copy/#scene) that does
      // not exist in a spine-rendered page, so lifting it here would be wrong.
      renderTemplate:
        `<!doctype html><html lang="en"><head>` +
        `<meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta name="theme-color" content="${escapeAttr(palette.primary)}">` +
        `<title>${escapeHtml(title)}</title>` +
        `</head><body>${SECTION_ANCHOR}</body></html>`,
      designContract: null,
      palette,
    },
    sections,
    motion,
    meta: {
      brief: { brandName: intake.brandName, headline },
      sourceUrl: intake.sourceUrl,
      // Lets Irie Builder's "Edit in Animate" reopen this project at
      // <ANIMATE_URL>/preview/<id>.
      animateProjectId: project.id,
      platform: "irie-builder",
    },
  };
}

/* ------------------------------------------------------------------ *
 * Deterministic source-image-set hash (FNV-1a, zero-dependency).
 * Stable across runs for the same selected media/source-image set so the
 * builder can decide whether motion needs a recook.
 * ------------------------------------------------------------------ */

function sourceImageSetHash(project: EditorProject): string {
  const intake = project.intake;
  const recipe = project.recipe;
  const ids = new Set<string>();

  for (const asset of project.assets) {
    if (asset.purpose === "reference" || asset.purpose === "generated") ids.add(`asset:${asset.name}`);
  }
  if (intake) {
    const selectedMedia = recipe?.selectedMediaIds?.length
      ? intake.media.filter((media) => recipe.selectedMediaIds.includes(media.id))
      : intake.media;
    for (const media of selectedMedia) ids.add(`media:${media.url}`);
    const selectedProducts = recipe?.selectedProductIds?.length
      ? intake.products.filter((product) => recipe.selectedProductIds.includes(product.id))
      : intake.products;
    for (const product of selectedProducts) ids.add(`product:${product.imageUrl}`);
  }

  const canonical = [...ids].sort().join("|");
  return `fnv1a-${fnv1a(canonical)}`;
}

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/* ------------------------------------------------------------------ *
 * Zero-dependency validator (mirror of irie-builder validate.ts rules).
 * ------------------------------------------------------------------ */

const SPINE_SOURCES: readonly SpineSource[] = ["builder-generate", "import", "animate"];
const SPINE_BLOCK_TYPES: readonly SpineBlockType[] = [
  "hero",
  "text-media",
  "cards",
  "proof",
  "cta",
  "faq",
  "commerce",
  "imported",
  "video-hero",
  "scroll-sequence",
];
const MOTION_INTENSITIES: readonly string[] = ["calm", "loud", "unhinged"];
const MOTION_BLOCKS: readonly SpineBlockType[] = ["video-hero", "scroll-sequence"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function validateSpine(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { valid: false, errors: ["spine must be an object"] };
  }

  if (value.version !== "site.spine.v1") {
    errors.push(`version must be 'site.spine.v1' (received ${JSON.stringify(value.version)})`);
  }

  if (!SPINE_SOURCES.includes(value.source as SpineSource)) {
    errors.push(`source must be one of ${SPINE_SOURCES.join(", ")} (received ${JSON.stringify(value.source)})`);
  }

  const shell = value.shell;
  if (!isObject(shell)) {
    errors.push("shell must be an object");
  } else {
    if (typeof shell.renderTemplate !== "string") {
      errors.push("shell.renderTemplate must be a string");
    }
    const palette = shell.palette;
    if (!isObject(palette)) {
      errors.push("shell.palette must be an object");
    } else {
      for (const field of ["primary", "accent", "background"] as const) {
        if (typeof palette[field] !== "string") {
          errors.push(`shell.palette.${field} must be a string`);
        }
      }
    }
  }

  let hasMotionBlock = false;
  const sections = value.sections;
  if (!Array.isArray(sections)) {
    errors.push("sections must be an array");
  } else {
    const seenIds = new Set<string>();
    sections.forEach((section, index) => {
      if (!isObject(section)) {
        errors.push(`sections[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(section.id)) {
        errors.push(`sections[${index}].id must be a non-empty string`);
      } else {
        if (seenIds.has(section.id)) {
          errors.push(`duplicate section id '${section.id}'`);
        }
        seenIds.add(section.id);
      }
      if (!SPINE_BLOCK_TYPES.includes(section.block as SpineBlockType)) {
        errors.push(`sections[${index}].block must be one of ${SPINE_BLOCK_TYPES.join(", ")} (received ${JSON.stringify(section.block)})`);
      } else if (MOTION_BLOCKS.includes(section.block as SpineBlockType)) {
        hasMotionBlock = true;
      }
      if (!isObject(section.content)) {
        errors.push(`sections[${index}].content must be an object`);
      }
    });
  }

  const motion = value.motion;
  if (hasMotionBlock && motion === undefined) {
    errors.push("motion bundle is required when a section block is video-hero or scroll-sequence");
  }
  if (motion !== undefined) {
    if (!isObject(motion)) {
      errors.push("motion must be an object");
    } else {
      const frames = motion.frames;
      if (!isObject(frames)) {
        errors.push("motion.frames must be an object");
      } else {
        if (typeof frames.desktop !== "string") errors.push("motion.frames.desktop must be a string");
        if (typeof frames.mobile !== "string") errors.push("motion.frames.mobile must be a string");
        if (typeof frames.count !== "number") errors.push("motion.frames.count must be a number");
        if (typeof frames.pattern !== "string") errors.push("motion.frames.pattern must be a string");
      }
      const video = motion.video;
      if (!isObject(video)) {
        errors.push("motion.video must be an object");
      } else {
        if (typeof video.desktop !== "string") errors.push("motion.video.desktop must be a string");
        if (typeof video.mobile !== "string") errors.push("motion.video.mobile must be a string");
        if (typeof video.poster !== "string") errors.push("motion.video.poster must be a string");
      }
      if (!MOTION_INTENSITIES.includes(motion.intensity as string)) {
        errors.push(`motion.intensity must be one of ${MOTION_INTENSITIES.join(", ")} (received ${JSON.stringify(motion.intensity)})`);
      }
      const recook = motion.recook;
      if (!isObject(recook)) {
        errors.push("motion.recook must be an object");
      } else {
        if (typeof recook.frameCount !== "number") errors.push("motion.recook.frameCount must be a number");
        if (typeof recook.sourceImageSetHash !== "string") errors.push("motion.recook.sourceImageSetHash must be a string");
      }
    }
  }

  const meta = value.meta;
  if (!isObject(meta)) {
    errors.push("meta must be an object");
  } else if (meta.platform !== "irie-builder") {
    errors.push(`meta.platform must be 'irie-builder' (received ${JSON.stringify(meta.platform)})`);
  }

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ *
 * Local HTML escaping (kept self-contained; does not touch exportSite).
 * ------------------------------------------------------------------ */

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
