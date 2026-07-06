# Irie Animate

Irie Animate is a local editor for turning brand/product references into scroll-driven animated websites.

It is not a static screenshot mockup. The app keeps editable project state, renders a canvas frame preview, cooks WebP frame sequences, stores uploaded assets, and exports a static scroll site package.

## What Works

- Project-backed editor state in `.irie-animate/projects/irie-demo/project.json`
- Brand, scene, timeline, checklist, vitals, and asset edits through local API routes
- Canvas preview that scrubs generated WebP frame sequences
- Desktop/mobile frame loading
- Undo/redo for project edits
- Working far-left rail modes, settings, help, and collapse behavior
- Logo/reference asset upload with local file storage
- Project-driven frame generation through `POST /api/pipeline/demo`
- Project-driven static export through `POST /api/export`
- Honest publish fallback that prepares an export package when Vercel is not connected

## Engine Reality

The animation engine is a frame-sequence engine:

1. The pipeline creates optimized `.webp` frame folders under `public/frames/<brand>/<scene>/`.
2. The editor loads those frames into memory.
3. A `<canvas>` draws the selected frame based on playhead/scrub progress.
4. The exported site uses the same canvas technique and maps scroll progress to frames.

For a still reference image, the local generator uses `sharp` to create cinematic pan/zoom/light-shift frames. That produces real frame animation, but it is not AI video generation.

For real MP4 clips, the pipeline can extract frames through `scripts/extract_frames.py` and `ffmpeg`, then optimize them for scroll playback.

## What Is Local-Only

- Vercel deployment is not authenticated in this app. `Prepare Export` creates a deployable static folder instead.
- Higgsfield/Fable generation is not called from this repo. Bring generated clips or reference media into the local pipeline.
- The included demo frames are generated assets so the editor opens with a working preview.

## Run It

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Rebuild Frames

From the editor, use `Settings -> Rebuild frames`, or run:

```bash
npm run pipeline:demo
```

The current API-backed route writes a generated project brand config first, so editor state can feed the frame pipeline.

## Export

From the editor, use `Prepare Export`, or run:

```bash
curl -X POST http://localhost:3000/api/export
```

The static package is written to:

```text
exports/irie-demo-animated-site
```

## Verify

```bash
npm run typecheck
npm run build
```

`npm run typecheck` runs `next typegen` first so a clean checkout does not depend on stale `.next/types`.

## Main Files

- `src/components/IrieAnimateApp.tsx` - editor UI and local interaction state
- `src/lib/projectStore.ts` - file-backed local project store
- `src/lib/projectBrand.ts` - maps editable project state into render/export brand config
- `pipeline/build-frames.mjs` - Sharp/ffmpeg-backed frame generation
- `src/lib/exportSite.ts` - static scroll-site export
- `app/api/**` - local project, asset, pipeline, export, and publish fallback APIs
