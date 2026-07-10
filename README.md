# Irie Animate

Irie Animate does one job: it turns a public storefront into an animated website.

## Use it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

1. Enter the storefront URL.
2. Choose up to six products.
3. Choose a motion level.
4. Build the site.
5. Preview or download the finished site.

There is no separate landing page, tenant admin, dashboard, timeline, readiness score, or advanced Studio UI.

## What it creates

- A desktop and mobile scroll-frame sequence
- A desktop and mobile MP4 hero film when local FFmpeg is available
- A responsive six-section storefront
- Product cards linked back to working store pages
- A downloadable ZIP containing the complete static site

Project files and downloaded product media are stored under `.irie-animate/`. Generated frames are written under `public/frames/<projectId>/`. Finished static sites and ZIP files are written under `exports/`.

## Main code

- `src/components/GuidedBuilder.tsx` — the complete user workflow
- `src/lib/storefrontIntake.ts` — reads public storefront content and products
- `src/lib/experienceGenerator.ts` — builds source media, frames, films, and exports
- `src/lib/exportSite.ts` — produces the finished static site
- `pipeline/build-frames.mjs` — creates optimized desktop and mobile WebP frames

## Verify

```bash
npm run verify
```
