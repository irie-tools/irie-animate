# Irie Animate Handoff

## Current Repo

- GitHub: https://github.com/irie-tools/irie-animate
- Branch: `main`
- Product shape: local-first SaaS-style scroll animation builder
- Front door: `/`
- Builder studio: `/studio`
- Tenant admin: `/admin`

## What Is Real

- The builder is backed by local project JSON in `.irie-animate/projects/irie-demo/project.json`.
- The tenant admin is backed by local tenant JSON in `.irie-animate/tenants/ak.json`.
- `/api/tenant` reads and updates tenant identity, plan/status, limits, feature flags, and onboarding gates.
- `/api/brain` computes readiness, blockers, strengths, stats, and next actions from current project and frame state.
- `/api/pipeline/cook` writes a generated brand config and runs the frame pipeline.
- `/api/pipeline/demo` remains as a compatibility alias to `/api/pipeline/cook`.
- `/api/export` writes the static scroll-site export package.
- The Studio canvas previews real WebP frame sequences under `public/frames/irie-demo`.

## Engine Truth

Irie Animate is a frame-sequence engine.

- With mapped MP4/MOV scene source assets, the cook route extracts frames through `scripts/extract_frames.py` and `ffmpeg`.
- Without mapped video sources, the cook route falls back to the reference/demo generator.
- The generator uses `sharp` to create optimized WebP frames from the demo/reference source.
- The editor and exported site scrub frames on a `<canvas>`.
- It is not currently calling Fable, Higgsfield, or an AI video model.

## Recent Upgrade Trail

1. `d995e48` - Added Project Brain and source-aware cook pipeline.
2. `6f37118` - Added SaaS front door, Studio route, tenant admin, and tenant API.

## Verification Used

```bash
npm run typecheck
npm run build
```

Browser smoke coverage used Playwright against local dev:

- `/` front door loads and shows workflow instructions.
- `/admin` loads and saves tenant settings.
- `/studio` loads the editor and tenant state.
- `/api/tenant` returns the active tenant.
- `/api/brain` returns the live brain score and mode.

## Codegraph

Codegraph has been initialized in this checkout.

```bash
codegraph init --index
```

The live local index is at `.codegraph/codegraph.db`. Codegraph's own `.codegraph/.gitignore` keeps the database machine-local, so the repo tracks the marker/ignore file and each agent can reindex after pulling.

MCP query smoke passed for:

```text
LandingPage AdminConsole tenantStore projectBrain projectPipeline IrieAnimateApp routes
```

Most recent observed local state:

- Tenant workspace: `Aurelia Studio`
- Tenant initials: `AK`
- Brain score: `72`
- Brain mode: `bitmap-reference`
- Cooked frames: `194`

## Important Files

- `src/components/LandingPage.tsx` - public front door.
- `src/components/AdminConsole.tsx` - tenant admin console.
- `src/components/IrieAnimateApp.tsx` - builder studio.
- `src/lib/tenantStore.ts` - local tenant persistence.
- `src/lib/projectStore.ts` - local project persistence.
- `src/lib/projectBrain.ts` - deterministic readiness analyzer.
- `src/lib/projectPipeline.ts` - source-aware frame cook runner.
- `src/lib/projectBrand.ts` - project-to-brand-config mapper.
- `pipeline/build-frames.mjs` - frame generation and video extraction dispatch.
- `src/lib/exportSite.ts` - static scroll-site package writer.

## Next Useful Moves

- Replace local-only tenant state with real auth and tenant membership when this becomes hosted.
- Add project creation and tenant project lists instead of the single seeded `irie-demo` project.
- Add upload/delete/rename controls for assets and source videos.
- Add a persisted cook run history so the Brain can compare previous runs.
- Add a deployment provider integration after export package quality is stable.
- Add automated tests around `projectBrain`, `tenantStore`, and source-video scene mapping.

## Gotchas

- Do not run `next build` while `next dev` is serving the same `.next` directory; it can confuse the dev bundle. Stop dev, build, then restart dev.
- `.irie-animate/` is ignored on purpose. It holds local workspace state and uploaded assets.
- `public/frames/irie-demo` is committed so the app opens with a working visual preview.
- Frame cooks may update manifest timestamps and generated frame assets.
