import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBrandConfigFromProject } from "./projectBrand";
import { readProject, type EditorProject } from "./projectStore";
import type { FramesManifest } from "./types";

export type ExportResult = { outputDir: string; files: string[] };

export async function exportStaticSite(projectId = "irie-demo"): Promise<ExportResult> {
  const cwd = process.cwd();
  const project = await readProject(projectId);
  const brand = buildBrandConfigFromProject(project);
  const brandId = project.brandId;
  const outputDir = resolve(cwd, "exports", `${projectId}-animated-site`);
  const framesDir = resolve(cwd, "public", "frames", brandId);
  const manifestPath = resolve(framesDir, "frames.manifest.json");
  if (!existsSync(manifestPath)) throw new Error("Cook the frame sequence before exporting.");

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(resolve(outputDir, "public", "frames"), { recursive: true });
  await mkdir(resolve(outputDir, "brands"), { recursive: true });
  await mkdir(resolve(outputDir, "assets"), { recursive: true });
  await cp(framesDir, resolve(outputDir, "public", "frames", brandId), { recursive: true });
  await writeFile(resolve(outputDir, "brands", `${brandId}.json`), `${JSON.stringify(brand, null, 2)}\n`, "utf8");

  const assetUrls = new Map<string, string>();
  const files = ["index.html", "README.md", `brands/${brandId}.json`, `public/frames/${brandId}/frames.manifest.json`];
  for (const asset of project.assets) {
    if (!existsSync(asset.path)) continue;
    const filename = `${asset.id}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await cp(asset.path, resolve(outputDir, "assets", filename));
    assetUrls.set(asset.id, `./assets/${filename}`);
    files.push(`assets/${filename}`);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FramesManifest;
  await writeFile(resolve(outputDir, "index.html"), buildStaticHtml(project, manifest, assetUrls), "utf8");
  await writeFile(resolve(outputDir, "README.md"), buildReadme(project), "utf8");
  return { outputDir, files };
}

function buildStaticHtml(project: EditorProject, manifest: FramesManifest, assetUrls: Map<string, string>) {
  const intake = project.intake;
  const colors = project.recipe?.palette?.length ? project.recipe.palette : intake?.palette ?? ["#0a0a08", "#148942", "#ffd51f", "#ed2c25"];
  const hero = manifest.scenes.find((scene) => scene.target === "hero") ?? manifest.scenes[0];
  const products = (intake?.products ?? []).filter((product) => project.recipe?.selectedProductIds.includes(product.id)).slice(0, 6);
  const heroVideo = project.generated?.heroVideoAssetId ? assetUrls.get(project.generated.heroVideoAssetId) : undefined;
  const mobileVideo = project.generated?.mobileVideoAssetId ? assetUrls.get(project.generated.mobileVideoAssetId) : heroVideo;
  const intensity = project.recipe?.intensity ?? "loud";
  const cards = products.map((product, index) => {
    const image = product.assetId ? assetUrls.get(product.assetId) : product.imageUrl;
    return `<article class="product-card tilt-${index % 3}"><span>0${index + 1}</span><img src="${escapeHtml(image || "")}" alt="${escapeHtml(product.name)}" loading="lazy"><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.price || "Fresh drop")}</p><a href="${escapeHtml(product.purchaseUrl || intake?.shopUrl || "#")}" target="_blank" rel="noreferrer">Get yours ↗</a></article>`;
  }).join("");
  const chapters = (project.recipe?.chapters ?? ["Hero", "Philosophy", "Featured drop", "Product story", "Community", "Shop"]).map((chapter, index) => `<a href="#chapter-${index + 1}"><b>0${index + 1}</b>${escapeHtml(chapter)}</a>`).join("");
  const frameBase = `./public/frames/${project.brandId}/${hero?.id || "hero"}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${colors[0]}"><title>${escapeHtml(intake?.brandName || project.name)} — Animated Experience</title>
<style>
:root{--ink:${colors[0]};--green:${colors[1] || "#148942"};--yellow:${colors[2] || "#ffd51f"};--red:${colors[3] || "#ed2c25"};--paper:#f3eedf}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ink);color:var(--paper);font-family:Arial,Helvetica,sans-serif;overflow-x:hidden}a{color:inherit}.grain{position:fixed;inset:0;pointer-events:none;z-index:20;opacity:.07;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E")}.nav{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;justify-content:space-between;align-items:center;padding:20px 3vw;mix-blend-mode:difference}.nav strong{font:900 clamp(18px,2vw,28px)/1 Arial Black,sans-serif;letter-spacing:.08em}.nav a{font-size:12px;text-transform:uppercase;letter-spacing:.2em;text-decoration:none}.hero-scroll{height:340vh;position:relative}.stage{position:sticky;top:0;height:100vh;overflow:hidden;background:#050505}.stage canvas,.stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.stage canvas{z-index:1}.stage video{z-index:0;opacity:.7}.wash{position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(0,0,0,.78),transparent 58%),linear-gradient(0deg,rgba(0,0,0,.55),transparent 45%)}.hero-copy{position:absolute;z-index:3;left:5vw;bottom:9vh;max-width:1050px}.eyebrow{display:flex;gap:14px;align-items:center;text-transform:uppercase;letter-spacing:.28em;font-size:11px}.eyebrow:before{content:"";width:42px;height:5px;background:var(--yellow)}h1{font:900 clamp(64px,13vw,190px)/.75 Arial Black,sans-serif;letter-spacing:-.075em;text-transform:uppercase;margin:.15em 0;color:var(--paper);max-width:8ch}.hero-copy p{max-width:520px;font-size:clamp(16px,1.5vw,23px);line-height:1.35}.scroll-cue{position:absolute;z-index:4;right:3vw;bottom:6vh;writing-mode:vertical-rl;text-transform:uppercase;letter-spacing:.25em;font-size:10px}.chapter-nav{padding:3vw;display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:#222}.chapter-nav a{background:var(--paper);color:#111;padding:22px 14px;text-decoration:none;text-transform:uppercase;font-weight:900;font-size:11px}.chapter-nav b{display:block;color:var(--red);margin-bottom:18px}.manifesto{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:8vw 5vw;background:var(--green);color:#071008;position:relative}.manifesto h2,.drop h2,.community h2{font:900 clamp(62px,10vw,150px)/.78 Arial Black,sans-serif;text-transform:uppercase;letter-spacing:-.07em;margin:0}.manifesto p{font:700 clamp(20px,3vw,42px)/1.1 Arial,sans-serif;max-width:22ch}.sun{position:absolute;width:30vw;aspect-ratio:1;border:4vw solid var(--yellow);border-radius:50%;right:-9vw;top:-12vw;mix-blend-mode:multiply}.drop{padding:10vw 3vw;background:var(--yellow);color:#111}.drop-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:7vw}.drop-head p{max-width:360px;font-weight:700}.product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3vw}.product-card{background:var(--paper);padding:16px;box-shadow:12px 12px 0 var(--red);transform:rotate(-1deg);transition:transform .25s}.product-card:nth-child(even){transform:rotate(1.5deg);box-shadow:12px 12px 0 var(--green)}.product-card:hover{transform:rotate(0) translateY(-8px)}.product-card span{font-weight:900;color:var(--red)}.product-card img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;margin:12px 0;filter:saturate(1.12) contrast(1.04)}.product-card h3{font:900 clamp(22px,3vw,42px)/.9 Arial Black,sans-serif;text-transform:uppercase;margin:20px 0 8px}.product-card p{font-weight:900}.product-card a{display:inline-block;background:#111;color:white;padding:14px 18px;text-transform:uppercase;text-decoration:none;font-weight:900}.community{min-height:100vh;padding:10vw 5vw;display:flex;flex-direction:column;justify-content:center;background:var(--red);position:relative;overflow:hidden}.community h2{max-width:9ch;position:relative;z-index:2}.community .stamp{position:absolute;right:5vw;top:20%;border:6px solid var(--yellow);border-radius:50%;width:240px;aspect-ratio:1;display:grid;place-items:center;font:900 28px Arial Black;transform:rotate(14deg);color:var(--yellow)}footer{padding:8vw 5vw;background:#070707;display:grid;grid-template-columns:1.5fr 1fr;gap:5vw}footer h2{font:900 clamp(52px,9vw,140px)/.8 Arial Black;margin:0;text-transform:uppercase}footer a.button{align-self:end;justify-self:start;background:var(--yellow);color:#111;padding:20px 28px;text-decoration:none;font-weight:900;text-transform:uppercase}.reveal{opacity:0;transform:translateY(60px);transition:1s cubic-bezier(.2,.8,.2,1)}.reveal.in{opacity:1;transform:none}
h1{font-size:clamp(52px,9vw,130px);line-height:.76;max-width:12ch}
@media(max-width:760px){.nav{padding:16px}.hero-scroll{height:260vh}.hero-copy{left:20px;right:20px;bottom:8vh}h1{font-size:clamp(56px,19vw,92px);max-width:8ch}.chapter-nav{grid-template-columns:repeat(2,1fr)}.manifesto{grid-template-columns:1fr;padding:24vw 20px}.manifesto p{margin-top:12vw}.drop{padding:24vw 20px}.drop-head{display:block}.product-grid{grid-template-columns:1fr;gap:50px}.community{padding:30vw 20px}.community .stamp{width:140px;top:8%;opacity:.75}footer{grid-template-columns:1fr;padding:24vw 20px}.scroll-cue{display:none}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-scroll{height:100vh}.reveal{opacity:1;transform:none}.stage video{display:none}}
</style></head><body class="motion-${intensity}"><div class="grain"></div><nav class="nav"><strong>${escapeHtml(project.brand.logoText)}</strong><a href="#shop">Shop the drop</a></nav>
<section class="hero-scroll" id="chapter-1"><div class="stage">${heroVideo ? `<video autoplay muted loop playsinline poster="${frameBase}/desktop/frame-0001.webp"><source media="(max-width:760px)" src="${mobileVideo}"><source src="${heroVideo}" type="video/mp4"></video>` : ""}<canvas id="scene"></canvas><div class="wash"></div><div class="hero-copy"><div class="eyebrow">${escapeHtml(intensity)} motion / fresh energy</div><h1>${escapeHtml(intake?.headline || project.name)}</h1><p>${escapeHtml(intake?.description || "A new kind of storefront. Built to move.")}</p></div><div class="scroll-cue">Scroll to bend reality</div></div></section>
<nav class="chapter-nav">${chapters}</nav>
<section class="manifesto" id="chapter-2"><div class="sun"></div><h2 class="reveal">Wear your frequency.</h2><p class="reveal">This is the same shop, pushed through a louder lens. Real products. Real links. A whole lot more life.</p></section>
<section class="drop" id="chapter-3"><div class="drop-head"><h2 class="reveal">The<br>drop.</h2><p class="reveal">Picked from the storefront and rebuilt as a moving collection.</p></div><div class="product-grid">${cards}</div></section>
<section class="community" id="chapter-5"><div class="stamp">ONE LOVE</div><p class="eyebrow">No beige brands allowed</p><h2 class="reveal">Made for the people who bring the vibe.</h2></section>
<footer id="shop"><h2>${escapeHtml(project.brand.logoText)}</h2><a class="button" href="${escapeHtml(intake?.shopUrl || intake?.sourceUrl || "#")}" target="_blank" rel="noreferrer">Enter the shop ↗</a></footer>
<script>
const scene=${JSON.stringify(hero || {})},base=${JSON.stringify(frameBase)};const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d'),frames=[];let ticking=false;const mobile=matchMedia('(max-width:760px)').matches,folder=mobile?'mobile':'desktop',count=scene.frameCount||1;for(let i=1;i<=count;i++){const img=new Image();img.decoding='async';img.src=base+'/'+folder+'/frame-'+String(i).padStart(4,'0')+'.webp';if(i===1)img.onload=draw;frames.push(img)}function draw(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;const section=document.querySelector('.hero-scroll'),max=Math.max(1,section.offsetHeight-innerHeight),p=Math.max(0,Math.min(1,-section.getBoundingClientRect().top/max)),img=frames[Math.round(p*(frames.length-1))]||frames[0];ctx.fillStyle='#050505';ctx.fillRect(0,0,canvas.width,canvas.height);if(img&&img.complete&&img.naturalWidth){const s=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight),w=img.naturalWidth*s,h=img.naturalHeight*s;ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h)}ticking=false}addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(draw);ticking=true}},{passive:true});addEventListener('resize',draw);new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('in',e.isIntersecting)),{threshold:.18}).observe(document.body);document.querySelectorAll('.reveal').forEach(el=>new IntersectionObserver(([e])=>e.isIntersecting&&el.classList.add('in'),{threshold:.18}).observe(el));draw();
</script></body></html>`;
}

function buildReadme(project: EditorProject) {
  return `# ${project.name} animated site\n\nGenerated by Irie Animate.\n\n## View locally\n\n\`\`\`bash\npython3 -m http.server 8080\n\`\`\`\n\nOpen http://localhost:8080. Every product link points back to the imported storefront.\n`;
}

function escapeHtml(value: string) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
