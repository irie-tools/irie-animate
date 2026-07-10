# Irie Animate

Irie Animate turns a live storefront into a scroll-driven animated website, then lets you fine-tune the result in a full local studio.

It is not a static screenshot mockup. The app keeps editable project state, renders a canvas frame preview, cooks WebP frame sequences, stores uploaded assets, and exports a static scroll site package.

## What Works

- Public front door at `/` with workflow instructions and product positioning
- Guided storefront builder at `/create`
- Public-URL intake for brand copy, palette, products, prices, images, and links
- Calm, loud, and unhinged motion recipes
- Storefront-product hero compositions, desktop/mobile frame cooking, and local MP4 hero-film encoding
- Multi-project local storage instead of a single hard-coded demo
- Private generated previews at `/preview/<projectId>`
- Six-chapter static site exports with real product cards and working storefront links
- Builder studio at `/studio`
- Tenant admin back door at `/admin`
- Local tenant backend in `.irie-animate/tenants/ak.json`
- Project-backed editor state in `.irie-animate/projects/<projectId>/project.json`
- Brand, scene, timeline, checklist, vitals, and asset edits through local API routes
- Canvas preview that scrubs generated WebP frame sequences
- Desktop/mobile frame loading
- Undo/redo for project edits
- Working far-left rail modes, settings, help, and collapse behavior
- Logo/reference asset upload with local file storage
- Project-driven frame cooking through `POST /api/pipeline/cook`
- A real Project Brain panel/API that scores engine readiness, names blockers, recommends next actions, auto-maps uploaded videos to scenes, and syncs checklist truth from project state
- Project-driven static export through `POST /api/export`
- Honest publish fallback that prepares an export package when Vercel is not connected

## Engine Reality

The animation engine is a frame-sequence engine:

1. The pipeline creates optimized `.webp` frame folders under `public/frames/<brand>/<scene>/`.
2. The editor loads those frames into memory.
3. A `<canvas>` draws the selected frame based on playhead/scrub progress.
4. The exported site uses the same canvas technique and maps scroll progress to frames.

For storefront intake, the local generator downloads the chosen product images, builds a branded hero source, uses `sharp` to create cinematic pan/zoom/light-shift frames, and uses local `ffmpeg` to package desktop and mobile hero films. This is deterministic local creative automation, not a paid AI-video call.

For real MP4 clips, the pipeline can extract frames through `scripts/extract_frames.py` and `ffmpeg`, then optimize them for scroll playback.

In the editor, uploaded MP4/MOV files become scene source assets. When a scene points at a video source, `POST /api/pipeline/cook` extracts frames from that footage. When no video source is mapped, the cook route deliberately falls back to the demo/reference generator so the preview remains usable.

## What Is Local-Only

- Vercel deployment is not authenticated in this app. `Prepare Export` creates a deployable static folder instead.
- Higgsfield/Fable generation is not called from this repo. The guided builder produces its own local product film; generated clips can still be uploaded in Studio.
- The included demo frames are generated assets so the editor opens with a working preview.
- Tenant/auth is currently local workspace state, not a hosted identity provider. `/admin` is an operator console, not secure production auth yet.

## Run It

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Routes:

- `/` - front door and usage instructions
- `/create` - paste a storefront and run the guided generator
- `/studio` - Irie Animate builder
- `/studio?projectId=<id>` - fine-tune a generated project
- `/preview/<projectId>` - view the private generated site
- `/admin` - local tenant admin console

## Golden Path

1. Open `http://localhost:3000/create`.
2. Paste a public storefront URL.
3. Pick up to six products.
4. Choose calm, loud, or unhinged.
5. Generate the experience, open its preview, or continue in Studio.

The generator keeps all project state and downloaded media under `.irie-animate/`, cooks runtime frames under `public/frames/<projectId>/`, and writes the deployable package under `exports/<projectId>-animated-site/`. Those generated folders are intentionally ignored by Git.

## Rebuild Frames

From the editor, use `Settings -> Rebuild frames`, the Inspect panel's `Cook frames`, or run:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"projectId":"irie-demo"}' \
  http://localhost:3000/api/pipeline/cook
```

The API-backed route writes a generated project brand config first, so editor state can feed the frame pipeline. The legacy `POST /api/pipeline/demo` route remains as a compatibility alias.

## Export

From the editor, use `Prepare Export`, or run:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"projectId":"irie-demo"}' \
  http://localhost:3000/api/export
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
- `src/components/GuidedBuilder.tsx` - URL-to-preview golden path
- `src/components/LandingPage.tsx` - public SaaS front door
- `src/components/AdminConsole.tsx` - local tenant back door
- `src/lib/projectStore.ts` - file-backed local project store
- `src/lib/tenantStore.ts` - file-backed local tenant store
- `src/lib/projectBrand.ts` - maps editable project state into render/export brand config
- `src/lib/projectBrain.ts` - deterministic project readiness, blocker, and next-action analyzer
- `src/lib/projectPipeline.ts` - source-aware project cook runner
- `src/lib/storefrontIntake.ts` - public storefront reader
- `src/lib/experienceGenerator.ts` - product-media, frame, film, and export orchestration
- `pipeline/build-frames.mjs` - Sharp/ffmpeg-backed frame generation
- `src/lib/exportSite.ts` - static scroll-site export
- `app/api/**` - local project, asset, pipeline, export, and publish fallback APIs
