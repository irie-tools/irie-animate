import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import sharp from "sharp";
import { exportStaticSite } from "./exportSite";
import { getProjectDir, readProject, updateProject, type EditorProject, type MotionRecipe, type WebsiteSection } from "./projectStore";
import type { FramesManifest } from "./types";

type ProjectAsset = EditorProject["assets"][number];

export async function generateExperience(projectId: string, recipePatch: Partial<MotionRecipe> = {}) {
  let project = await readProject(projectId);
  if (!project.intake) throw new Error("Analyze a website before generating an experience.");

  const recipe: MotionRecipe = {
    ...(project.recipe ?? {
      intensity: "loud",
      heroDuration: 10,
      frameCount: 96,
      selectedSectionIds: [],
      selectedMediaIds: [],
      selectedProductIds: [],
      palette: project.intake.palette,
      chapters: project.intake.sections.slice(0, 6).map((section) => section.title)
    }),
    ...recipePatch
  };
  const selectedSections = project.intake.sections.filter((section) => recipe.selectedSectionIds.includes(section.id)).slice(0, 6);
  const selectedProducts = project.intake.products.filter((product) => recipe.selectedProductIds.includes(product.id)).slice(0, 6);
  const requestedMedia = project.intake.media.filter((media) => recipe.selectedMediaIds.includes(media.id));
  const imageUrls = [...new Set([
    ...requestedMedia.map((media) => media.url),
    ...selectedSections.flatMap((section) => section.imageUrls),
    ...selectedProducts.map((product) => product.imageUrl),
    ...project.intake.media.map((media) => media.url)
  ])].slice(0, 10);
  if (!selectedSections.length) throw new Error("Select at least one website section.");

  const assetsDir = resolve(getProjectDir(projectId), "assets");
  await mkdir(assetsDir, { recursive: true });
  const downloadedResults = (await Promise.all(imageUrls.map((url, index) => downloadImage(url, index, assetsDir)))).filter(
    (result): result is { url: string; asset: ProjectAsset } => Boolean(result)
  );
  const downloaded = downloadedResults.map((result) => result.asset);
  const generatedScenes = downloaded.length >= 4
    ? []
    : await generateBrandScenes(project, selectedSections, recipe, assetsDir, Math.max(4, selectedSections.length) - downloaded.length);
  const visualAssets = [...downloaded, ...generatedScenes];

  const films = await buildMotionFilm(project, recipe, visualAssets.map((asset) => asset.path), assetsDir);
  const urlToAssetId = new Map(downloadedResults.map(({ url, asset }) => [url, asset.id]));
  const intake = {
    ...project.intake,
    media: project.intake.media.map((media) => ({ ...media, assetId: urlToAssetId.get(media.url) ?? media.assetId })),
    products: project.intake.products.map((product) => ({ ...product, assetId: urlToAssetId.get(product.imageUrl) ?? product.assetId }))
  };
  const generatedIds = new Set([...visualAssets, ...films].map((asset) => asset.id));
  const heroFilm = films.find((asset) => asset.id === "hero-film");
  const mobileFilm = films.find((asset) => asset.id === "hero-film-mobile");
  const poster = films.find((asset) => asset.id === "generated-poster");
  project = await updateProject(projectId, {
    intake,
    recipe: { ...recipe, chapters: selectedSections.map((section) => section.title) },
    assets: [...project.assets.filter((asset) => !generatedIds.has(asset.id) && !asset.id.startsWith("generated-scene-") && !asset.id.startsWith("source-image-") && !["hero-film", "hero-film-mobile", "generated-poster"].includes(asset.id)), ...visualAssets, ...films],
    scenes: project.scenes.map((scene) => ({ ...scene, sourceAssetId: heroFilm?.id })),
    generated: {
      ...project.generated,
      heroVideoAssetId: heroFilm?.id,
      mobileVideoAssetId: mobileFilm?.id,
      posterAssetId: poster?.id,
      generatedAt: new Date().toISOString()
    },
    checklist: project.checklist.map((item) => ({ ...item, done: ["Website analyzed", "Sections selected", "Local motion film generated"].includes(item.label) || item.done }))
  });

  const manifest = await cookLocalMotionFrames(project, recipe);
  project = await updateProject(projectId, {
    checklist: project.checklist.map((item) => ({ ...item, done: ["Website analyzed", "Sections selected", "Local motion film generated", "Frames optimized", "SEO and AEO packaged", "Static export prepared", "Final preview"].includes(item.label) || item.done })),
    vitals: [
      { label: "Motion source", value: generatedScenes.length ? `${downloaded.length} source + ${generatedScenes.length} created` : `${downloaded.length} source images`, status: "Good" },
      { label: "Video", value: heroFilm ? "local MP4" : "frames", status: heroFilm ? "Good" : "Watch" },
      { label: "Search", value: "SEO + AEO", status: "Good" },
      { label: "Mobile", value: "responsive", status: "Good" }
    ]
  });
  const exported = await exportStaticSite(projectId);
  project = await updateProject(projectId, { generated: { ...project.generated, exportDir: exported.outputDir } });
  return {
    project,
    manifest,
    mode: generatedScenes.length ? "local-visual-rescue" : "local-image-sequence",
    exported,
    motion: {
      imageCount: visualAssets.length,
      sourceImageCount: downloaded.length,
      generatedImageCount: generatedScenes.length,
      localVideo: Boolean(heroFilm),
      apiCalls: 0
    }
  };
}

async function downloadImage(url: string, index: number, assetsDir: string): Promise<{ url: string; asset: ProjectAsset } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2_000) return null;
    const extension = imageExtension(contentType, url);
    const id = `source-image-${String(index + 1).padStart(2, "0")}`;
    const path = resolve(assetsDir, `${id}${extension}`);
    await writeFile(path, bytes);
    return { url, asset: { id, name: `${id}${extension}`, type: contentType, size: bytes.length, path, addedAt: new Date().toISOString(), purpose: "reference" } };
  } catch {
    return null;
  }
}

async function generateBrandScenes(project: EditorProject, sections: WebsiteSection[], recipe: MotionRecipe, assetsDir: string, requestedCount: number): Promise<ProjectAsset[]> {
  const sceneCount = Math.max(1, Math.min(6, requestedCount));
  const assets: ProjectAsset[] = [];
  for (let index = 0; index < sceneCount; index += 1) {
    const section = sections[index % sections.length];
    const id = `generated-scene-${String(index + 1).padStart(2, "0")}`;
    const path = resolve(assetsDir, `${id}.jpg`);
    await sharp(generatedSceneSvg(project, section.heading, section.kind, recipe, index, 1600, 900))
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toFile(path);
    const info = await stat(path);
    assets.push({ id, name: `${id}.jpg`, type: "image/jpeg", size: info.size, path, addedAt: new Date().toISOString(), purpose: "generated" });
  }
  return assets;
}

function generatedSceneSvg(project: EditorProject, heading: string, kind: string, recipe: MotionRecipe, index: number, width: number, height: number) {
  const palette = [0, 1, 2, 3].map((position) => safeColor(recipe.palette[position], ["#080808", "#E8C928", "#F4F0E8", "#3155FF"][position]));
  const [ink, accent, paper, signal] = palette;
  const seed = hash(`${project.id}-${heading}-${index}`);
  const x = 300 + seed % 920;
  const y = 180 + (seed >> 3) % 520;
  const rotation = -18 + (seed % 37);
  const chapter = String(index + 1).padStart(2, "0");
  const keyword = heading.split(/\s+/).filter((word) => word.length > 4)[0] || project.name;
  const variant = index % 4;
  const art = variant === 0
    ? `<circle cx="${x}" cy="${y}" r="270" fill="url(#orb)"/><circle cx="${x}" cy="${y}" r="350" fill="none" stroke="${paper}" stroke-opacity=".15"/><path d="M0 760 L1600 520 M0 820 L1600 580 M0 880 L1600 640" stroke="${accent}" stroke-opacity=".25" stroke-width="2"/>`
    : variant === 1
      ? `<g transform="rotate(${rotation} 800 450)"><rect x="-240" y="110" width="2050" height="170" fill="${accent}" opacity=".86"/><rect x="-240" y="330" width="2050" height="70" fill="${signal}" opacity=".58"/><rect x="-240" y="455" width="2050" height="240" fill="url(#glass)"/></g>`
      : variant === 2
        ? `<g fill="none" stroke="${accent}">${Array.from({ length: 7 }, (_, ring) => `<circle cx="${x}" cy="${y}" r="${80 + ring * 58}" opacity="${0.72 - ring * 0.08}" stroke-width="${ring === 0 ? 10 : 2}"/>`).join("")}</g><path d="M120 690 C440 470 720 790 1030 420 S1440 270 1580 120" fill="none" stroke="${paper}" stroke-width="3" stroke-opacity=".5"/>`
        : `<g transform="translate(${x - 520} ${y - 300}) rotate(${rotation})">${Array.from({ length: 12 }, (_, tile) => `<rect x="${(tile % 4) * 190}" y="${Math.floor(tile / 4) * 190}" width="150" height="150" rx="${tile % 3 === 0 ? 75 : 10}" fill="${tile % 2 ? accent : signal}" opacity="${0.18 + (tile % 4) * 0.13}"/>`).join("")}</g>`;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${ink}"/><stop offset=".58" stop-color="${ink}"/><stop offset="1" stop-color="${signal}" stop-opacity=".62"/></linearGradient><radialGradient id="orb"><stop stop-color="${paper}" stop-opacity=".92"/><stop offset=".35" stop-color="${accent}" stop-opacity=".86"/><stop offset="1" stop-color="${signal}" stop-opacity="0"/></radialGradient><linearGradient id="glass"><stop stop-color="${paper}" stop-opacity=".08"/><stop offset="1" stop-color="${accent}" stop-opacity=".35"/></linearGradient><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="4"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .13 0"/></filter></defs><rect width="100%" height="100%" fill="url(#bg)"/>${art}<text x="78" y="110" fill="${paper}" fill-opacity=".68" font-family="Arial" font-size="17" letter-spacing="8">${escapeXml(project.brand.logoText)}</text><text x="80" y="790" fill="${accent}" font-family="Arial" font-size="15" letter-spacing="6">${escapeXml(kind.toUpperCase())} / ${chapter}</text><text x="1540" y="820" text-anchor="end" fill="${paper}" fill-opacity=".1" font-family="Georgia" font-size="190" font-weight="bold">${escapeXml(keyword.toUpperCase().slice(0, 12))}</text><text x="800" y="520" text-anchor="middle" fill="${paper}" fill-opacity=".08" font-family="Georgia" font-size="500" font-weight="bold">${chapter}</text><rect width="100%" height="100%" filter="url(#noise)" opacity=".32"/></svg>`);
}

async function buildMotionFilm(project: EditorProject, recipe: MotionRecipe, paths: string[], assetsDir: string): Promise<ProjectAsset[]> {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (ffmpeg.status !== 0) throw new Error("FFmpeg is required for local image-to-video generation. Install it with: brew install ffmpeg");
  const framesDir = resolve(getProjectDir(project.id), "motion-source-frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  const frameCount = Math.max(36, Math.min(120, recipe.frameCount));
  const width = 1600;
  const height = 900;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const position = (frame / frameCount) * paths.length;
    const imageIndex = Math.floor(position) % paths.length;
    const localProgress = position - Math.floor(position);
    const nextIndex = (imageIndex + 1) % paths.length;
    const current = await renderMovingImage(paths[imageIndex], localProgress, width, height, imageIndex % 2 === 0 ? 1 : -1, recipe.intensity);
    const crossfade = clamp((localProgress - 0.72) / 0.28, 0, 1);
    const composites: sharp.OverlayOptions[] = [];
    if (crossfade > 0) {
      const next = await renderMovingImage(paths[nextIndex], Math.max(0, localProgress - 0.72) / 0.28, width, height, nextIndex % 2 === 0 ? -1 : 1, recipe.intensity);
      composites.push({ input: await sharp(next).ensureAlpha(crossfade).png().toBuffer(), left: 0, top: 0, blend: "over" });
    }
    composites.push({ input: motionOverlay(project, recipe, frame / Math.max(1, frameCount - 1), width, height), left: 0, top: 0, blend: "over" });
    await sharp(current).composite(composites).jpeg({ quality: 88, chromaSubsampling: "4:2:0" }).toFile(resolve(framesDir, `frame-${String(frame + 1).padStart(4, "0")}.jpg`));
  }

  const posterPath = resolve(assetsDir, "generated-poster.jpg");
  await copyFile(resolve(framesDir, "frame-0001.jpg"), posterPath);
  const fps = Math.max(6, Math.round(frameCount / Math.max(5, recipe.heroDuration)));
  const desktopPath = resolve(assetsDir, "hero-film.mp4");
  const mobilePath = resolve(assetsDir, "hero-film-mobile.mp4");
  encodeVideo(framesDir, desktopPath, fps, "1600:900");
  encodeVideo(framesDir, mobilePath, fps, "900:506");
  const outputs: Array<{ id: string; name: string; path: string; type: string }> = [
    { id: "generated-poster", name: "generated-poster.jpg", path: posterPath, type: "image/jpeg" },
    { id: "hero-film", name: "hero-film.mp4", path: desktopPath, type: "video/mp4" },
    { id: "hero-film-mobile", name: "hero-film-mobile.mp4", path: mobilePath, type: "video/mp4" }
  ];
  const assets: ProjectAsset[] = [];
  for (const output of outputs) {
    if (!existsSync(output.path)) continue;
    const info = await stat(output.path);
    assets.push({ id: output.id, name: output.name, type: output.type, size: info.size, path: output.path, addedAt: new Date().toISOString(), purpose: "source" });
  }
  return assets;
}

async function renderMovingImage(path: string, progress: number, width: number, height: number, direction: number, intensity: MotionRecipe["intensity"]) {
  const strength = intensity === "calm" ? 0.05 : intensity === "loud" ? 0.1 : 0.16;
  const zoom = 1.08 + progress * strength;
  const resizedWidth = Math.ceil(width * zoom);
  const resizedHeight = Math.ceil(height * zoom);
  const maxLeft = Math.max(0, resizedWidth - width);
  const maxTop = Math.max(0, resizedHeight - height);
  const leftProgress = direction > 0 ? progress : 1 - progress;
  const left = Math.round(maxLeft * (0.15 + leftProgress * 0.7));
  const top = Math.round(maxTop * (0.35 + Math.sin(progress * Math.PI) * 0.2));
  return sharp(path)
    .rotate()
    .resize(resizedWidth, resizedHeight, { fit: "cover", position: "attention" })
    .extract({ left: clamp(left, 0, maxLeft), top: clamp(top, 0, maxTop), width, height })
    .modulate({ brightness: 0.88 + Math.sin(progress * Math.PI) * 0.08, saturation: intensity === "calm" ? 0.92 : 1.12 })
    .toBuffer();
}

function motionOverlay(project: EditorProject, recipe: MotionRecipe, progress: number, width: number, height: number) {
  const palette = recipe.palette.length ? recipe.palette : ["#080808", "#D8B97A"];
  const pulse = recipe.intensity === "unhinged" ? 0.22 + Math.sin(progress * Math.PI * 8) * 0.08 : 0.16;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="#000" stop-opacity=".62"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="${palette[1] || palette[0]}" stop-opacity="${pulse}"/></linearGradient><radialGradient id="v"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/><rect width="100%" height="100%" fill="url(#v)"/><text x="72" y="82" fill="white" fill-opacity=".82" font-family="Arial" font-size="18" letter-spacing="7">${escapeXml(project.brand.logoText)}</text><text x="${width - 84}" y="${height - 54}" text-anchor="end" fill="white" fill-opacity=".6" font-family="Arial" font-size="14" letter-spacing="5">${String(Math.round(progress * 100)).padStart(2, "0")} / 100</text></svg>`);
}

function encodeVideo(framesDir: string, outputPath: string, fps: number, scale: string) {
  const result = spawnSync("ffmpeg", ["-y", "-framerate", String(fps), "-i", resolve(framesDir, "frame-%04d.jpg"), "-vf", `scale=${scale}:force_original_aspect_ratio=increase,crop=${scale}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-crf", "23", outputPath], { encoding: "utf8", timeout: 180_000 });
  if (result.status !== 0) throw new Error(result.stderr || "Local video encoding failed.");
}

async function cookLocalMotionFrames(project: EditorProject, recipe: MotionRecipe): Promise<FramesManifest> {
  const sourceDir = resolve(getProjectDir(project.id), "motion-source-frames");
  const sourceFrames = (await readdir(sourceDir)).filter((name) => /^frame-\d{4}\.jpg$/.test(name)).sort();
  if (!sourceFrames.length) throw new Error("Local motion frames were not created.");
  const publicRoot = resolve(process.cwd(), "public", "frames", project.brandId);
  const sceneRoot = resolve(publicRoot, "hero");
  const desktopDir = resolve(sceneRoot, "desktop");
  const mobileDir = resolve(sceneRoot, "mobile");
  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(desktopDir, { recursive: true });
  await mkdir(mobileDir, { recursive: true });
  const targetCount = Math.min(sourceFrames.length, Math.max(36, recipe.frameCount));

  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex = Math.min(sourceFrames.length - 1, Math.round((index / Math.max(1, targetCount - 1)) * (sourceFrames.length - 1)));
    const input = resolve(sourceDir, sourceFrames[sourceIndex]);
    const name = `frame-${String(index + 1).padStart(4, "0")}.webp`;
    await Promise.all([
      sharp(input).resize(1600, 900, { fit: "cover", position: "attention" }).webp({ quality: 78, effort: 4 }).toFile(resolve(desktopDir, name)),
      sharp(input).resize(900, 506, { fit: "cover", position: "attention" }).webp({ quality: 72, effort: 4 }).toFile(resolve(mobileDir, name))
    ]);
  }
  const totalBytes = await directoryBytes(sceneRoot);
  const scene = {
    id: "hero",
    target: "hero" as const,
    title: project.intake?.headline || project.name,
    frameCount: targetCount,
    framePattern: `/frames/${project.brandId}/hero/desktop/frame-{index}.webp`,
    poster: `/frames/${project.brandId}/hero/desktop/frame-0001.webp`,
    dimensions: { width: 1600, height: 900 },
    totalBytes,
    totalMb: Number((totalBytes / 1024 / 1024).toFixed(2)),
    source: "local image-sequenced motion film"
  };
  const manifest: FramesManifest = {
    brandId: project.brandId,
    generatedAt: new Date().toISOString(),
    scenes: [scene],
    budgets: { heroMaxMb: 10, totalMaxMb: 24 }
  };
  const sourceImageCount = project.assets.filter((asset) => asset.purpose === "reference").length;
  const generatedImageCount = project.assets.filter((asset) => asset.purpose === "generated").length;
  await writeFile(resolve(sceneRoot, "manifest.json"), `${JSON.stringify({ source: { kind: generatedImageCount ? "local visual rescue" : "local image sequence", imageCount: sourceImageCount + generatedImageCount, sourceImageCount, generatedImageCount }, desktop: { resolution: "1600x900", actual_count: targetCount }, mobile: { resolution: "900x506", actual_count: targetCount }, created: manifest.generatedAt }, null, 2)}\n`, "utf8");
  await writeFile(resolve(publicRoot, "frames.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function directoryBytes(path: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = resolve(path, entry.name);
    total += entry.isDirectory() ? await directoryBytes(entryPath) : (await stat(entryPath)).size;
  }
  return total;
}

function imageExtension(contentType: string, url: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  const ext = extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value: string) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function safeColor(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value! : fallback;
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
