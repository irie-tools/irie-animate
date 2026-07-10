# Irie Animate

Irie Animate turns a public website into a cinematic animated site. It reads the site's pages, sections, copy, images, and links, then builds the motion package on your Mac.

The main job is website transformation. When Irie Animate finds a store, it adds optional product selection and shop styling to the same workflow.

## Run it

You need Node.js 20 or newer and FFmpeg.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

1. Enter any public website URL.
2. Choose up to six sections.
3. Choose Cinematic, Dynamic, or Experimental motion.
4. Build the site.
5. Preview the result in an iframe or download the static website.

## Local motion engine

Irie Animate downloads the source site's public images and turns them into:

- a desktop MP4 hero film
- a mobile MP4 hero film
- desktop and mobile WebP scroll frames
- a cinematic scroll experience with image dissolves, camera movement, particles, grain, chapter copy, and reduced-motion support

Sharp renders the image sequence. FFmpeg encodes the MP4 files. The motion engine makes no Higgsfield or animation API calls.

## Website output

Each download contains a static website with:

- the cinematic hero and selected website sections
- the site's existing calls to action and links
- an optional product section when commerce is detected
- responsive desktop and mobile layouts
- metadata, canonical tags, Open Graph, and Twitter cards
- Organization or LocalBusiness schema, WebSite schema, and FAQ schema
- Product list and VideoObject schema when the site supports them
- `robots.txt`, `sitemap.xml`, `llms.txt`, and visible answer-ready FAQs
- a draft `mcp-actions.json` manifest for future agent actions

The SEO and AEO package supplies technical structure and clear answers. It does not promise rankings or AI citations. Keyword strategy still requires live search and Search Console data.

## Files

Irie Animate stores project data and downloaded media under `.irie-animate/`. It writes scroll frames under `public/frames/<projectId>/` and finished sites under `exports/`.

The main implementation lives in:

- `src/components/GuidedBuilder.tsx`: four-step builder
- `src/lib/storefrontIntake.ts`: generic website crawler and optional commerce detection
- `src/lib/experienceGenerator.ts`: local image sequencing, MP4 encoding, and frame generation
- `src/lib/exportSite.ts`: cinematic static site, SEO/AEO files, and commerce layer

## Verify

```bash
npm run verify
```
