#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(process.argv.slice(2));
const brandId = args.brand || "irie-demo";
const demoMode = Boolean(args.demo);
const brandPath = args.config ? resolve(root, args.config) : resolve(root, "brands", `${brandId}.json`);

if (!existsSync(brandPath)) {
  fail(`Brand config not found: ${brandPath}`);
}

const brand = JSON.parse(readFileSync(brandPath, "utf8"));
const publicRoot = resolve(root, "public", "frames", brand.id);
mkdirSync(publicRoot, { recursive: true });

const scenes = [];

for (const scene of brand.scenes) {
  const sceneDir = join(publicRoot, scene.id);
  rmSync(sceneDir, { recursive: true, force: true });
  mkdirSync(sceneDir, { recursive: true });

  if (scene.sourceVideo && existsSync(resolve(root, scene.sourceVideo)) && !demoMode) {
    runVideoExtraction(scene, sceneDir);
  } else if (brand.demoSource?.imagePath && existsSync(brand.demoSource.imagePath)) {
    await generateBitmapScene(brand, scene, sceneDir);
  } else {
    await generateDemoScene(brand, scene, sceneDir);
  }

  const desktopDir = join(sceneDir, "desktop");
  const poster = `/frames/${brand.id}/${scene.id}/desktop/frame-0001.webp`;
  const frameCount = countFrames(desktopDir);
  const totalBytes = directoryBytes(sceneDir);
  scenes.push({
    id: scene.id,
    target: scene.target,
    title: scene.title,
    frameCount,
    framePattern: `/frames/${brand.id}/${scene.id}/desktop/frame-{index}.webp`,
    poster,
    dimensions: { width: 1600, height: 900 },
    totalBytes,
    totalMb: Number((totalBytes / 1024 / 1024).toFixed(2)),
    source: scene.sourceVideo || (brand.demoSource?.imagePath ? "bitmap reference image" : "generated SVG fallback")
  });
}

const manifest = {
  brandId: brand.id,
  generatedAt: new Date().toISOString(),
  scenes,
  budgets: {
    heroMaxMb: 10,
    totalMaxMb: 24
  }
};

writeFileSync(join(publicRoot, "frames.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part === "--demo") {
      parsed.demo = true;
    } else if (part === "--brand") {
      parsed.brand = argv[i + 1];
      i += 1;
    } else if (part === "--config") {
      parsed.config = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function runVideoExtraction(scene, sceneDir) {
  const input = resolve(root, scene.sourceVideo);
  const frames = String(scene.frames || 120);
  const result = spawnSync(
    "python3",
    [
      resolve(root, "scripts", "extract_frames.py"),
      "--input",
      input,
      "--output",
      sceneDir,
      "--frames",
      frames,
      "--quality",
      "78",
      "--desktop-res",
      "1600x900",
      "--mobile-res",
      "900x506"
    ],
    { cwd: root, encoding: "utf8" }
  );

  if (result.status !== 0) {
    fail(`Frame extraction failed for ${scene.id}\n${result.stderr || result.stdout}`);
  }
}

async function generateDemoScene(brand, scene, sceneDir) {
  const frameCount = scene.frames || 72;
  const desktopDir = join(sceneDir, "desktop");
  const mobileDir = join(sceneDir, "mobile");
  mkdirSync(desktopDir, { recursive: true });
  mkdirSync(mobileDir, { recursive: true });

  for (let i = 1; i <= frameCount; i += 1) {
    const progress = (i - 1) / Math.max(1, frameCount - 1);
    const svgDesktop = makeFrameSvg(brand, scene, progress, 1600, 900);
    const svgMobile = makeFrameSvg(brand, scene, progress, 900, 506);
    const name = `frame-${String(i).padStart(4, "0")}.webp`;

    await sharp(Buffer.from(svgDesktop)).webp({ quality: 82 }).toFile(join(desktopDir, name));
    await sharp(Buffer.from(svgMobile)).webp({ quality: 76 }).toFile(join(mobileDir, name));
  }

  const sourceManifest = {
    source: { filename: "generated-demo", duration: 8, resolution: "1600x900", fps: 12 },
    frames: { target_count: frameCount, format: "webp", quality: 82 },
    recommended_scroll_height: `${scene.scrollRangeVh || 500}vh`,
    desktop: { resolution: "1600x900", actual_count: frameCount },
    mobile: { resolution: "900x506", actual_count: frameCount },
    created: new Date().toISOString()
  };
  writeFileSync(join(sceneDir, "manifest.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`);
}

async function generateBitmapScene(brand, scene, sceneDir) {
  const frameCount = scene.frames || 72;
  const desktopDir = join(sceneDir, "desktop");
  const mobileDir = join(sceneDir, "mobile");
  mkdirSync(desktopDir, { recursive: true });
  mkdirSync(mobileDir, { recursive: true });

  const source = brand.demoSource.imagePath;
  const metadata = await sharp(source).metadata();
  const crop = clampCrop(brand.demoSource.crop, metadata.width || 0, metadata.height || 0, scene.id);
  const cropBuffer = await sharp(source).extract(crop).toBuffer();

  for (let i = 1; i <= frameCount; i += 1) {
    const progress = (i - 1) / Math.max(1, frameCount - 1);
    const name = `frame-${String(i).padStart(4, "0")}.webp`;
    await renderBitmapFrame(cropBuffer, brand, scene, progress, 1600, 900, join(desktopDir, name), 82);
    await renderBitmapFrame(cropBuffer, brand, scene, progress, 900, 506, join(mobileDir, name), 76);
  }

  const sourceManifest = {
    source: {
      filename: source,
      duration: 8,
      resolution: `${metadata.width || "?"}x${metadata.height || "?"}`,
      kind: "bitmap reference"
    },
    frames: { target_count: frameCount, format: "webp", quality: 82 },
    recommended_scroll_height: `${scene.scrollRangeVh || 500}vh`,
    desktop: { resolution: "1600x900", actual_count: frameCount },
    mobile: { resolution: "900x506", actual_count: frameCount },
    created: new Date().toISOString()
  };
  writeFileSync(join(sceneDir, "manifest.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`);
}

async function renderBitmapFrame(cropBuffer, brand, scene, progress, width, height, outputPath, quality) {
  const eased = easeInOut(progress);
  const sceneZoom = scene.id === "gallery" ? 1.2 : scene.id === "logo" ? 1.08 : 1.12;
  const zoom = sceneZoom + eased * 0.09;
  const zoomedWidth = Math.ceil(width * zoom);
  const zoomedHeight = Math.ceil(height * zoom);
  const maxLeft = Math.max(0, zoomedWidth - width);
  const maxTop = Math.max(0, zoomedHeight - height);
  const drift = scene.id === "gallery" ? 0.84 : scene.id === "logo" ? 0.3 : 0.58;
  const left = Math.round(maxLeft * (drift - 0.12 + eased * 0.2));
  const top = Math.round(maxTop * (scene.id === "gallery" ? 0.46 : 0.5 + Math.sin(progress * Math.PI) * 0.06));

  const base = await sharp(cropBuffer)
    .resize(zoomedWidth, zoomedHeight, { fit: "cover" })
    .extract({
      left: clamp(left, 0, maxLeft),
      top: clamp(top, 0, maxTop),
      width,
      height
    })
    .modulate({
      brightness: 0.92 + Math.sin(progress * Math.PI) * 0.07,
      saturation: 1.08
    })
    .toBuffer();

  const overlay = makeBitmapOverlay(brand, scene, progress, width, height);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: brand.colors.background
    }
  })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: Buffer.from(overlay), left: 0, top: 0 }
    ])
    .webp({ quality })
    .toFile(outputPath);
}

function makeBitmapOverlay(brand, scene, progress, width, height) {
  const small = width < 1000;
  const railX = small ? 42 : 86;
  const label = scene.target === "footer" ? "TITLE LOCKUP" : scene.target.toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" x2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0.36"/>
        <stop offset="0.45" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.18"/>
      </linearGradient>
      <radialGradient id="vignette" cx="52%" cy="48%" r="70%">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.48"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#shade)"/>
    <rect width="${width}" height="${height}" fill="url(#vignette)"/>
    <g opacity="0.84">
      <line x1="${railX}" x2="${railX}" y1="${small ? 110 : 170}" y2="${height - (small ? 78 : 132)}" stroke="${brand.colors.secondary}" stroke-opacity="0.52"/>
      <circle cx="${railX}" cy="${Math.round((height - 160) * progress + 110)}" r="${small ? 4 : 6}" fill="${brand.colors.secondary}"/>
    </g>
    <text x="${width - (small ? 92 : 140)}" y="${height - (small ? 56 : 86)}" fill="${brand.colors.secondary}" font-family="Inter, Arial, sans-serif" font-size="${small ? 13 : 18}" letter-spacing="5">${Math.round(progress * 100)}%</text>
    <text x="${width - (small ? 94 : 145)}" y="${height - (small ? 34 : 58)}" fill="${brand.colors.secondary}" font-family="Inter, Arial, sans-serif" font-size="${small ? 10 : 14}" letter-spacing="4">SCROLL</text>
    <text x="${railX}" y="${height - (small ? 38 : 66)}" fill="${brand.colors.text}" fill-opacity="0.72" font-family="Inter, Arial, sans-serif" font-size="${small ? 11 : 14}" letter-spacing="4">${label}</text>
  </svg>`;
}

function clampCrop(crop, width, height, sceneId) {
  const sceneOffset = sceneId === "gallery" ? Math.round(crop.width * 0.08) : sceneId === "logo" ? -Math.round(crop.width * 0.04) : 0;
  const sceneTop = sceneId === "gallery" ? Math.round(crop.height * 0.03) : 0;
  const next = {
    left: clamp(crop.left + sceneOffset, 0, Math.max(0, width - 1)),
    top: clamp(crop.top + sceneTop, 0, Math.max(0, height - 1)),
    width: crop.width,
    height: crop.height
  };
  next.width = Math.min(next.width, width - next.left);
  next.height = Math.min(next.height, height - next.top);
  return next;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function makeFrameSvg(brand, scene, progress, width, height) {
  const accent = brand.colors.accent;
  const secondary = brand.colors.secondary;
  const bg = brand.colors.background;
  const text = brand.colors.text;
  const muted = brand.colors.muted;
  const sweep = Math.round(-18 + progress * 36);
  const productX = Math.round(width * (0.46 + progress * 0.1));
  const productY = Math.round(height * (0.52 - Math.sin(progress * Math.PI) * 0.05));
  const productW = Math.round(width * (0.34 + progress * 0.08));
  const glow = 0.18 + progress * 0.18;
  const phase = scene.target === "footer" ? "Logo motion" : scene.title;
  const small = width < 1000;
  const titleSize = small ? 38 : 68;
  const labelSize = small ? 15 : 20;

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${bg}"/>
        <stop offset="0.56" stop-color="#111820"/>
        <stop offset="1" stop-color="#070809"/>
      </linearGradient>
      <radialGradient id="aura" cx="${45 + progress * 24}%" cy="42%" r="45%">
        <stop offset="0" stop-color="${accent}" stop-opacity="${glow}"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="product" x1="0" x2="1">
        <stop offset="0" stop-color="#f8fbff"/>
        <stop offset="0.45" stop-color="#94a8b9"/>
        <stop offset="0.7" stop-color="${accent}"/>
        <stop offset="1" stop-color="${secondary}"/>
      </linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="${small ? 18 : 30}"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#aura)"/>
    <g opacity="0.15">
      ${Array.from({ length: 18 }, (_, n) => {
        const y = Math.round((height / 18) * n + progress * 30);
        return `<line x1="0" x2="${width}" y1="${y}" y2="${y + sweep}" stroke="${text}" stroke-opacity="0.18"/>`;
      }).join("")}
    </g>
    <ellipse cx="${productX}" cy="${productY + productW * 0.32}" rx="${productW * 0.44}" ry="${productW * 0.08}" fill="#000" opacity="0.5" filter="url(#blur)"/>
    <g transform="translate(${productX - productW / 2} ${productY - productW * 0.28}) rotate(${sweep * 0.08} ${productW / 2} ${productW / 3})">
      <path d="M ${productW * 0.07} ${productW * 0.38} C ${productW * 0.24} ${productW * 0.08}, ${productW * 0.72} ${productW * 0.04}, ${productW * 0.92} ${productW * 0.34} C ${productW * 0.75} ${productW * 0.51}, ${productW * 0.27} ${productW * 0.57}, ${productW * 0.07} ${productW * 0.38} Z" fill="url(#product)" opacity="0.94"/>
      <path d="M ${productW * 0.2} ${productW * 0.34} C ${productW * 0.36} ${productW * 0.2}, ${productW * 0.64} ${productW * 0.2}, ${productW * 0.79} ${productW * 0.34}" fill="none" stroke="#10151b" stroke-width="${productW * 0.045}" stroke-linecap="round" opacity="0.72"/>
      <circle cx="${productW * 0.26}" cy="${productW * 0.43}" r="${productW * 0.055}" fill="#0b0f12" stroke="${text}" stroke-opacity="0.35" stroke-width="${productW * 0.012}"/>
      <circle cx="${productW * 0.74}" cy="${productW * 0.43}" r="${productW * 0.055}" fill="#0b0f12" stroke="${text}" stroke-opacity="0.35" stroke-width="${productW * 0.012}"/>
    </g>
    <g transform="translate(${small ? 42 : 86} ${small ? 74 : 118})">
      <text x="0" y="0" fill="${muted}" font-family="Inter, Arial, sans-serif" font-size="${labelSize}" letter-spacing="4">${brand.motionTone.toUpperCase()}</text>
      <text x="0" y="${small ? 58 : 92}" fill="${text}" font-family="Georgia, serif" font-size="${titleSize}" font-weight="500">${escapeXml(phase)}</text>
      <text x="0" y="${small ? 96 : 140}" fill="${muted}" font-family="Inter, Arial, sans-serif" font-size="${small ? 18 : 24}">${Math.round(progress * 100)}% frame scrub</text>
    </g>
    <g transform="translate(${width - (small ? 150 : 220)} ${height - (small ? 92 : 130)})" opacity="0.92">
      <rect x="0" y="0" width="${small ? 94 : 132}" height="${small ? 94 : 132}" rx="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)"/>
      <text x="${small ? 47 : 66}" y="${small ? 58 : 80}" text-anchor="middle" fill="${text}" font-family="Georgia, serif" font-size="${small ? 34 : 48}">${escapeXml(brand.logoText)}</text>
    </g>
  </svg>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function countFrames(dir) {
  if (!existsSync(dir)) return 0;
  return Number(spawnSync("find", [dir, "-name", "frame-*.webp"], { encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean).length);
}

function directoryBytes(dir) {
  if (!existsSync(dir)) return 0;
  const result = spawnSync("find", [dir, "-type", "f"], { encoding: "utf8" });
  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .reduce((total, file) => total + statSync(file).size, 0);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
