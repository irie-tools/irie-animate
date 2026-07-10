// Standalone verification for the site.spine.v1 emitter.
// Run: npx tsx scripts/verify-spine.ts   (or: node scripts/verify-spine.ts on Node >=22)
//
// Builds a spine from a representative fixture project/manifest/assets and
// asserts the shape the Irie Builder editor depends on.

import { buildSiteSpine, validateSpine } from "../src/lib/siteSpine";
import type { EditorProject } from "../src/lib/projectStore";
import type { FramesManifest } from "../src/lib/types";

const FRAME_COUNT = 96;

const manifest: FramesManifest = {
  brandId: "acme",
  generatedAt: new Date().toISOString(),
  scenes: [
    {
      id: "hero",
      target: "hero",
      title: "Acme headline",
      frameCount: FRAME_COUNT,
      framePattern: "/frames/acme/hero/desktop/frame-{index}.webp",
      poster: "/frames/acme/hero/desktop/frame-0001.webp",
      dimensions: { width: 1600, height: 900 },
      totalBytes: 1234567,
      totalMb: 1.18,
      source: "local image-sequenced motion film",
    },
  ],
  budgets: { heroMaxMb: 10, totalMaxMb: 24 },
};

const project = {
  id: "acme",
  name: "Acme",
  version: "v2.0.0",
  brandId: "acme",
  activeSceneId: "hero",
  brand: { kit: "Acme", logoText: "ACME", motionTone: "Loud", colors: [], typography: [] },
  scenes: [],
  timeline: [],
  assets: [
    { id: "source-image-01", name: "source-image-01.jpg", type: "image/jpeg", size: 50000, path: "/x/source-image-01.jpg", addedAt: "", purpose: "reference" },
    { id: "generated-scene-01", name: "generated-scene-01.jpg", type: "image/jpeg", size: 60000, path: "/x/generated-scene-01.jpg", addedAt: "", purpose: "generated" },
    { id: "hero-film", name: "hero-film.mp4", type: "video/mp4", size: 900000, path: "/x/hero-film.mp4", addedAt: "", purpose: "source" },
  ],
  checklist: [],
  vitals: [],
  intake: {
    sourceUrl: "https://acme.example.com",
    shopUrl: "https://acme.example.com/shop",
    brandName: "Acme",
    headline: "Motion, rebuilt",
    description: "Acme turns a website into a cinematic scroll experience.",
    siteKind: "commerce",
    hasCommerce: true,
    palette: ["#0a0a08", "#c89848", "#f3eedf", "#4a6aff"],
    pages: [],
    sections: [
      { id: "sec-about", title: "About", heading: "About Acme", summary: "Who we are.", body: "Long about body.", kind: "about", imageUrls: [], sourceUrl: "https://acme.example.com/about" },
      { id: "sec-services", title: "Services", heading: "What we do", summary: "Our services.", body: "Long services body.", kind: "services", imageUrls: [], sourceUrl: "https://acme.example.com/services" },
      { id: "sec-shop", title: "Shop", heading: "The shop", summary: "Buy things.", body: "Shop body.", kind: "commerce", imageUrls: [], sourceUrl: "https://acme.example.com/shop" },
    ],
    media: [
      { id: "media-1", url: "https://acme.example.com/a.jpg", alt: "A", sourceUrl: "https://acme.example.com", assetId: "source-image-01" },
    ],
    products: [
      { id: "prod-1", name: "Widget", price: "$20", imageUrl: "https://acme.example.com/widget.jpg", purchaseUrl: "https://acme.example.com/p/widget", assetId: "source-image-01" },
    ],
    actions: [],
    socialLinks: [],
    seo: { sourceTitle: "Acme | Motion", sourceDescription: "", canonicalUrl: "", h1Count: 1, imagesWithAlt: 1, totalImages: 1, schemaTypes: [], issues: [] },
    answer: { summary: "Acme summary.", facts: [], faqs: [] },
    importedAt: "",
  },
  recipe: {
    intensity: "loud",
    heroDuration: 10,
    frameCount: FRAME_COUNT,
    selectedSectionIds: ["sec-about", "sec-services", "sec-shop"],
    selectedMediaIds: ["media-1"],
    selectedProductIds: ["prod-1"],
    palette: ["#0a0a08", "#c89848", "#f3eedf", "#4a6aff"],
    chapters: [],
  },
  generated: {
    heroVideoAssetId: "hero-film",
    mobileVideoAssetId: "hero-film-mobile",
    posterAssetId: "generated-poster",
    generatedAt: new Date().toISOString(),
  },
  updatedAt: "",
} as unknown as EditorProject;

const assetUrls = new Map<string, string>([
  ["hero-film", "./assets/hero-film-hero-film.mp4"],
  ["hero-film-mobile", "./assets/hero-film-mobile-hero-film-mobile.mp4"],
  ["generated-poster", "./assets/generated-poster-generated-poster.jpg"],
  ["source-image-01", "./assets/source-image-01-source-image-01.jpg"],
]);

const failures: string[] = [];
function check(label: string, condition: boolean) {
  if (!condition) failures.push(label);
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
}

const spine = buildSiteSpine(project, manifest, assetUrls);
const result = validateSpine(spine);

check(`validateSpine(spine).valid === true (${result.errors.join("; ") || "no errors"})`, result.valid === true);
check("source === 'animate'", spine.source === "animate");
check("meta.platform === 'irie-builder'", spine.meta.platform === "irie-builder");

const lockedVideoHeroes = spine.sections.filter((s) => s.block === "video-hero" && s.locked === true);
const lockedScrollSeqs = spine.sections.filter((s) => s.block === "scroll-sequence" && s.locked === true);
check("exactly one locked video-hero", lockedVideoHeroes.length === 1);
check("exactly one locked scroll-sequence", lockedScrollSeqs.length === 1);

check("motion present", spine.motion !== undefined);
check(
  `motion.frames.count matches manifest frameCount (${FRAME_COUNT})`,
  spine.motion?.frames.count === FRAME_COUNT
);
check(
  `motion.recook.frameCount matches manifest frameCount (${FRAME_COUNT})`,
  spine.motion?.recook.frameCount === FRAME_COUNT
);
check("motion.recook.sourceImageSetHash is a non-empty string", typeof spine.motion?.recook.sourceImageSetHash === "string" && spine.motion.recook.sourceImageSetHash.length > 0);

const contentSections = spine.sections.filter((s) => s.block !== "video-hero" && s.block !== "scroll-sequence");
check("content sections exist", contentSections.length > 0);
check("no content section is locked", contentSections.every((s) => s.locked !== true));

// Unique ids + html carries the matching data-irie-section-id.
const ids = spine.sections.map((s) => s.id);
check("all section ids unique", new Set(ids).size === ids.length);
check(
  "each section html carries data-irie-section-id matching its id",
  spine.sections.every((s) => typeof s.html === "string" && s.html.includes(`data-irie-section-id="${s.id}"`))
);

// Hash determinism.
const spine2 = buildSiteSpine(project, manifest, assetUrls);
check("sourceImageSetHash is deterministic", spine.motion?.recook.sourceImageSetHash === spine2.motion?.recook.sourceImageSetHash);

if (failures.length) {
  console.error(`\n${failures.length} check(s) FAILED:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nAll spine checks passed.");
