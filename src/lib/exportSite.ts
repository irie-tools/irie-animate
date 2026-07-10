import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBrandConfigFromProject } from "./projectBrand";
import { readProject, type EditorProject, type WebsiteSection } from "./projectStore";
import type { FramesManifest } from "./types";

export type ExportResult = { outputDir: string; files: string[] };

export async function exportStaticSite(projectId = "irie-demo"): Promise<ExportResult> {
  const cwd = process.cwd();
  const project = await readProject(projectId);
  const brand = buildBrandConfigFromProject(project);
  const outputDir = resolve(cwd, "exports", `${projectId}-animated-site`);
  const framesDir = resolve(cwd, "public", "frames", project.brandId);
  const manifestPath = resolve(framesDir, "frames.manifest.json");
  if (!existsSync(manifestPath)) throw new Error("Cook the frame sequence before exporting.");

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(resolve(outputDir, "public", "frames"), { recursive: true });
  await mkdir(resolve(outputDir, "brands"), { recursive: true });
  await mkdir(resolve(outputDir, "assets"), { recursive: true });
  await cp(framesDir, resolve(outputDir, "public", "frames", project.brandId), { recursive: true });
  await writeFile(resolve(outputDir, "brands", `${project.brandId}.json`), `${JSON.stringify(brand, null, 2)}\n`, "utf8");

  const assetUrls = new Map<string, string>();
  const files = ["index.html", "README.md", "robots.txt", "sitemap.xml", "llms.txt", "mcp-actions.json", "site-data.json", `brands/${project.brandId}.json`, `public/frames/${project.brandId}/frames.manifest.json`];
  for (const asset of project.assets) {
    if (!existsSync(asset.path)) continue;
    const filename = `${asset.id}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await cp(asset.path, resolve(outputDir, "assets", filename));
    assetUrls.set(asset.id, `./assets/${filename}`);
    files.push(`assets/${filename}`);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FramesManifest;
  await Promise.all([
    writeFile(resolve(outputDir, "index.html"), buildStaticHtml(project, manifest, assetUrls), "utf8"),
    writeFile(resolve(outputDir, "README.md"), buildReadme(project), "utf8"),
    writeFile(resolve(outputDir, "robots.txt"), buildRobots(project), "utf8"),
    writeFile(resolve(outputDir, "sitemap.xml"), buildSitemap(project), "utf8"),
    writeFile(resolve(outputDir, "llms.txt"), buildLlms(project), "utf8"),
    writeFile(resolve(outputDir, "mcp-actions.json"), `${JSON.stringify(buildMcpActions(project), null, 2)}\n`, "utf8"),
    writeFile(resolve(outputDir, "site-data.json"), `${JSON.stringify(buildSiteData(project), null, 2)}\n`, "utf8")
  ]);
  return { outputDir, files };
}

function buildStaticHtml(project: EditorProject, manifest: FramesManifest, assetUrls: Map<string, string>) {
  const intake = project.intake;
  if (!intake) throw new Error("Missing website analysis.");
  const colors = project.recipe?.palette?.length ? project.recipe.palette : intake.palette;
  const palette = [colors[0] || "#0a0a08", colors[1] || "#c89848", colors[2] || "#f3eedf", colors[3] || "#4a6aff"];
  const hero = manifest.scenes.find((scene) => scene.target === "hero") ?? manifest.scenes[0];
  const selectedSections = intake.sections.filter((section) => project.recipe?.selectedSectionIds.includes(section.id)).slice(0, 6);
  const sections = selectedSections.length ? selectedSections : intake.sections.slice(0, 6);
  const selectedProducts = intake.products.filter((product) => project.recipe?.selectedProductIds.includes(product.id)).slice(0, 6);
  const selectedMedia = intake.media.filter((media) => project.recipe?.selectedMediaIds.includes(media.id)).slice(0, 8);
  const heroVideo = project.generated?.heroVideoAssetId ? assetUrls.get(project.generated.heroVideoAssetId) : undefined;
  const mobileVideo = project.generated?.mobileVideoAssetId ? assetUrls.get(project.generated.mobileVideoAssetId) : heroVideo;
  const poster = project.generated?.posterAssetId ? assetUrls.get(project.generated.posterAssetId) : undefined;
  const frameBase = `./public/frames/${project.brandId}/${hero?.id || "hero"}`;
  const primaryAction = intake.actions[0] ?? { id: "visit", label: intake.hasCommerce ? "Visit the shop" : "Visit the original site", url: intake.sourceUrl, kind: "visit" as const };
  const overlays = buildOverlays(sections, primaryAction.url);
  const markers = sections.map((section, index) => `<button aria-label="${escapeHtml(section.title)}" data-marker="${index}"><span>${String(index + 1).padStart(2, "0")}</span></button>`).join("");
  const galleryItems = selectedMedia.map((media) => ({
    image: media.assetId ? assetUrls.get(media.assetId) || media.url : media.url,
    alt: media.alt
  }));
  if (galleryItems.length < 6) {
    for (const asset of project.assets.filter((item) => item.purpose === "generated")) {
      const image = assetUrls.get(asset.id);
      if (image) galleryItems.push({ image, alt: `${intake.brandName} generated brand scene` });
      if (galleryItems.length >= 8) break;
    }
  }
  const gallery = galleryItems.map((media, index) => `<figure class="gallery-item ${index % 4 === 0 ? "tall" : ""}" data-parallax="${index % 2 === 0 ? 18 : -14}"><img src="${escapeHtml(media.image)}" alt="${escapeHtml(media.alt)}" loading="lazy"><figcaption>${escapeHtml(media.alt)}</figcaption></figure>`).join("");
  const productCards = selectedProducts.map((product, index) => {
    const image = product.assetId ? assetUrls.get(product.assetId) : product.imageUrl;
    return `<article class="product-card"><span>${String(index + 1).padStart(2, "0")}</span><img src="${escapeHtml(image || product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy"><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.price || "View product")}</p><a href="${escapeHtml(product.purchaseUrl)}" target="_blank" rel="noreferrer">View product ↗</a></article>`;
  }).join("");
  const contentSections = sections.slice(1).map((section, index) => `<article class="content-block reveal"><span>${String(index + 2).padStart(2, "0")}</span><div><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body || section.summary)}</p></div></article>`).join("");
  const faq = intake.answer.faqs.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("");
  const schemas = buildSchemas(project, heroVideo, poster);
  const title = intake.seo.sourceTitle || `${intake.brandName} | ${intake.headline}`;
  const description = intake.seo.sourceDescription || intake.description;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${palette[0]}"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(intake.seo.canonicalUrl || intake.sourceUrl)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">${poster ? `<meta property="og:image" content="${poster}">` : ""}<meta name="twitter:card" content="summary_large_image"><link rel="mcp-actions" href="./mcp-actions.json">${schemas.map((schema) => `<script type="application/ld+json">${safeJson(schema)}</script>`).join("")}
<style>
:root{--ink:${palette[0]};--accent:${palette[1]};--paper:${palette[2]};--signal:${palette[3]};--muted:#aaa59b}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ink);color:var(--paper);font-family:"DM Sans",Arial,sans-serif;overflow-x:hidden}a{color:inherit}.loader{position:fixed;inset:0;background:var(--ink);z-index:9999;display:grid;place-items:center;transition:.7s}.loader.done{opacity:0;visibility:hidden;filter:blur(8px)}.loader-inner{text-align:center}.loader strong{display:block;font:500 clamp(28px,4vw,58px) Georgia,serif;letter-spacing:.14em}.loader-bar{width:180px;height:2px;background:#ffffff20;margin:24px auto 12px}.loader-bar i{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--accent),var(--signal))}.loader small{color:var(--muted);letter-spacing:.2em}.grain,.vignette{position:fixed;inset:0;pointer-events:none}.grain{z-index:100;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}.vignette{z-index:99;background:radial-gradient(circle at 50% 45%,transparent 42%,rgba(0,0,0,.52) 100%)}#particles{position:fixed;inset:0;z-index:15;pointer-events:none}.cursor-dot,.cursor-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9998;mix-blend-mode:difference}.cursor-dot{width:6px;height:6px;background:white}.cursor-ring{width:36px;height:36px;border:1px solid #ffffff80;transition:width .2s,height .2s}.site-nav{position:fixed;z-index:60;left:0;right:0;top:0;padding:26px 4vw;display:flex;justify-content:space-between;align-items:center;mix-blend-mode:difference}.site-nav strong{font-size:14px;letter-spacing:.2em}.site-nav a{text-decoration:none;text-transform:uppercase;font-size:10px;letter-spacing:.22em}.markers{position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:50;display:grid;gap:12px}.markers button{background:transparent;border:0;color:#ffffff55;padding:0;cursor:pointer}.markers button span{font-size:9px;letter-spacing:.1em}.markers button.active{color:var(--accent)}.animation-section{height:${Math.max(500, (hero?.frameCount || 96) * 6)}vh;position:relative}.stage{position:sticky;top:0;height:100vh;overflow:hidden;background:#050505}.stage video,.stage canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.stage video{z-index:0}.stage canvas{z-index:1}.stage:after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(0,0,0,.7),transparent 65%),linear-gradient(0deg,rgba(0,0,0,.5),transparent 45%)}.scroll-copy{position:absolute;z-index:10;left:6vw;top:50%;transform:translate(-20px,-50%);max-width:min(720px,80vw);opacity:0;filter:blur(6px);transition:.7s cubic-bezier(.2,.8,.2,1);pointer-events:none}.scroll-copy.visible{opacity:1;filter:none;transform:translate(0,-50%)}.scroll-copy .overline{font-size:10px;text-transform:uppercase;letter-spacing:.32em;color:var(--accent)}.scroll-copy h1,.scroll-copy h2{font:300 clamp(48px,7vw,108px)/.92 Georgia,serif;margin:.2em 0;letter-spacing:-.04em}.scroll-copy p{font-size:clamp(16px,1.6vw,23px);line-height:1.5;color:#e0ddd6;max-width:620px}.scroll-copy a{display:inline-block;margin-top:18px;padding:13px 18px;border:1px solid #ffffff70;text-decoration:none;text-transform:uppercase;letter-spacing:.14em;font-size:10px;pointer-events:auto}.below{position:relative;z-index:20;background:var(--ink)}.statement{min-height:82vh;padding:10vw 7vw;display:flex;align-items:center}.statement h2{font:300 clamp(52px,8vw,130px)/.9 Georgia,serif;max-width:12ch;margin:0}.content-list{padding:2vw 7vw 10vw}.content-block{display:grid;grid-template-columns:80px 1fr;gap:3vw;padding:55px 0;border-top:1px solid #ffffff20}.content-block>span{color:var(--accent);font-size:11px}.content-block h2{font:300 clamp(34px,5vw,74px)/1 Georgia,serif;margin:0 0 18px}.content-block p{max-width:760px;color:#c1bdb5;line-height:1.7;font-size:17px}.gallery{padding:9vw 7vw;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:280px;gap:18px;background:#11100e}.gallery-item{margin:0;overflow:hidden;position:relative}.gallery-item.tall{grid-row:span 2}.gallery img{width:100%;height:115%;object-fit:cover;transform:translateY(-7%)}.gallery figcaption{position:absolute;left:16px;bottom:14px;font-size:10px;text-transform:uppercase;letter-spacing:.14em}.commerce{padding:10vw 7vw;background:var(--accent);color:#111}.commerce h2,.faq h2{font:300 clamp(46px,7vw,100px)/.9 Georgia,serif;margin:0 0 6vw}.product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2vw}.product-card{background:var(--paper);padding:14px}.product-card>span{font-size:10px;color:#555}.product-card img{width:100%;aspect-ratio:4/5;object-fit:cover;margin:10px 0}.product-card h3{font-size:20px;margin:12px 0}.product-card a{display:inline-block;background:#111;color:white;padding:12px 15px;text-decoration:none;font-size:11px;text-transform:uppercase}.faq{padding:10vw 7vw}.faq details{max-width:900px;border-top:1px solid #ffffff20;padding:22px 0}.faq summary{font-size:20px;cursor:pointer}.faq p{color:#bcb8b0;line-height:1.6}.reveal{opacity:0;transform:translateY(40px);transition:.8s}.reveal.in{opacity:1;transform:none}footer{padding:10vw 7vw 6vw;background:#070706}footer h2{font:300 clamp(54px,9vw,140px)/.85 Georgia,serif;margin:0 0 4vw;max-width:10ch}footer a{display:inline-block;background:var(--accent);color:#111;padding:17px 22px;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:700;letter-spacing:.13em}
@media(max-width:760px){.cursor-dot,.cursor-ring,.markers{display:none}.site-nav{padding:18px}.animation-section{height:500vh}.scroll-copy{left:20px;max-width:calc(100vw - 40px)}.scroll-copy h1,.scroll-copy h2{font-size:clamp(46px,15vw,76px)}.statement,.content-list,.gallery,.commerce,.faq,footer{padding-left:20px;padding-right:20px}.content-block{grid-template-columns:36px 1fr}.gallery{grid-template-columns:1fr;grid-auto-rows:330px}.gallery-item.tall{grid-row:span 1}.product-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.animation-section{height:100vh}.scroll-copy{display:none}.scroll-copy:first-of-type{display:block;opacity:1;filter:none;transform:translate(0,-50%)}.reveal{opacity:1;transform:none}.cursor-dot,.cursor-ring,#particles{display:none}}
</style></head><body><div class="loader"><div class="loader-inner"><strong>${escapeHtml(intake.brandName)}</strong><div class="loader-bar"><i></i></div><small>0%</small></div></div><div class="grain"></div><div class="vignette"></div><canvas id="particles"></canvas><div class="cursor-dot"></div><div class="cursor-ring"></div><nav class="site-nav"><strong>${escapeHtml(project.brand.logoText)}</strong><a href="#contact">${escapeHtml(primaryAction.label)}</a></nav><nav class="markers" aria-label="Chapters">${markers}</nav>
<section class="animation-section"><div class="stage">${heroVideo ? `<video autoplay muted loop playsinline poster="${poster || `${frameBase}/desktop/frame-0001.webp`}"><source media="(max-width:760px)" src="${mobileVideo}"><source src="${heroVideo}" type="video/mp4"></video>` : ""}<canvas id="scene"></canvas>${overlays}</div></section>
<main class="below"><section class="statement"><h2 class="reveal">${escapeHtml(intake.description)}</h2></section><section class="content-list">${contentSections}</section>${gallery ? `<section class="gallery" aria-label="Selected imagery">${gallery}</section>` : ""}${intake.hasCommerce && productCards ? `<section class="commerce"><h2>The shop, rebuilt to move.</h2><div class="product-grid">${productCards}</div></section>` : ""}<section class="faq"><h2>Questions, answered.</h2>${faq}</section></main>
<footer id="contact"><h2>${escapeHtml(sections.at(-1)?.heading || intake.headline)}</h2><a href="${escapeHtml(primaryAction.url)}" data-mcp-action="${escapeHtml(primaryAction.id)}" data-mcp-description="${escapeHtml(primaryAction.label)}">${escapeHtml(primaryAction.label)} ↗</a></footer>
<script>
const scene=${JSON.stringify(hero || {})},frameBase=${JSON.stringify(frameBase)},section=document.querySelector('.animation-section'),canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d'),copies=[...document.querySelectorAll('.scroll-copy')],markers=[...document.querySelectorAll('[data-marker]')],loader=document.querySelector('.loader'),bar=document.querySelector('.loader-bar i'),counter=document.querySelector('.loader small'),frames=[],count=scene.frameCount||1,mobile=matchMedia('(max-width:760px)').matches,folder=mobile?'mobile':'desktop',critical=[0,Math.floor(count*.25),Math.floor(count*.5),Math.floor(count*.75),count-1];let loaded=0,currentFrame=0,targetFrame=0,mouseX=0,mouseY=0,ringX=0,ringY=0;
function loadFrame(i){return new Promise(resolve=>{if(frames[i])return resolve();const img=new Image();img.decoding='async';img.src=frameBase+'/'+folder+'/frame-'+String(i+1).padStart(4,'0')+'.webp';img.onload=img.onerror=()=>{frames[i]=img;loaded++;const pct=Math.round(loaded/count*100);bar.style.width=pct+'%';counter.textContent=pct+'%';draw(i);resolve()}})}
async function loadAll(){await Promise.all([...new Set(critical)].map(loadFrame));for(let i=0;i<count;i+=8)await Promise.all(Array.from({length:8},(_,n)=>i+n).filter(n=>n<count).map(loadFrame));loader.classList.add('done')}
const centers=copies.map((_,i)=>(i+.5)/copies.length),N=1600,density=Array.from({length:N},(_,i)=>{const x=i/(N-1);return 1+centers.reduce((sum,c)=>sum+3.2*Math.exp(-Math.pow(x-c,2)/(2*Math.pow(.045,2))),0)}),cdf=[0];for(let i=1;i<N;i++)cdf[i]=cdf[i-1]+(density[i-1]+density[i])/2;const total=cdf[N-1];for(let i=0;i<N;i++)cdf[i]/=total;function remap(raw){let lo=0,hi=N-1;while(lo<hi){const mid=(lo+hi)>>1;if(cdf[mid]<raw)lo=mid+1;else hi=mid}return lo/(N-1)}
function progress(){const r=section.getBoundingClientRect();return Math.max(0,Math.min(1,-r.top/(r.height-innerHeight)))}function nearest(i){for(let d=0;d<count;d++){if(frames[i-d]?.naturalWidth)return frames[i-d];if(frames[i+d]?.naturalWidth)return frames[i+d]}}
function draw(index=Math.round(currentFrame)){const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==innerWidth*dpr||canvas.height!==innerHeight*dpr){canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr}const img=nearest(Math.max(0,Math.min(count-1,index)));ctx.fillStyle='#050505';ctx.fillRect(0,0,canvas.width,canvas.height);if(img){const s=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight),w=img.naturalWidth*s,h=img.naturalHeight*s;ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h)}}
function tick(){const p=remap(progress());targetFrame=p*(count-1);currentFrame+=(targetFrame-currentFrame)*.1;draw();const active=Math.min(copies.length-1,Math.floor(p*copies.length));copies.forEach((copy,i)=>copy.classList.toggle('visible',i===active));markers.forEach((marker,i)=>marker.classList.toggle('active',i===active));ringX+=(mouseX-ringX)*.16;ringY+=(mouseY-ringY)*.16;document.querySelector('.cursor-ring').style.transform='translate('+(ringX-18)+'px,'+(ringY-18)+'px)';requestAnimationFrame(tick)}
addEventListener('mousemove',e=>{mouseX=e.clientX;mouseY=e.clientY;document.querySelector('.cursor-dot').style.transform='translate('+(mouseX-3)+'px,'+(mouseY-3)+'px)'},{passive:true});markers.forEach((marker,i)=>marker.addEventListener('click',()=>scrollTo({top:section.offsetTop+(section.offsetHeight-innerHeight)*(i/Math.max(1,markers.length-1)),behavior:'smooth'})));new IntersectionObserver(entries=>entries.forEach(e=>e.isIntersecting&&e.target.classList.add('in')),{threshold:.16}).observe(document.querySelector('.statement h2'));document.querySelectorAll('.reveal').forEach(el=>new IntersectionObserver(([e])=>e.isIntersecting&&el.classList.add('in'),{threshold:.16}).observe(el));
const pc=document.querySelector('#particles'),px=pc.getContext('2d'),particles=Array.from({length:40},()=>({x:Math.random(),y:Math.random(),r:.3+Math.random()*1.5,v:(Math.random()-.5)*.00025}));function particlesTick(){pc.width=innerWidth;pc.height=innerHeight;px.clearRect(0,0,pc.width,pc.height);px.fillStyle='rgba(255,255,255,.28)';particles.forEach(p=>{p.y=(p.y+p.v+1)%1;px.beginPath();px.arc(p.x*pc.width,p.y*pc.height,p.r,0,Math.PI*2);px.fill()});requestAnimationFrame(particlesTick)}loadAll();tick();particlesTick();
</script></body></html>`;
}

function buildOverlays(sections: WebsiteSection[], actionUrl: string) {
  return sections.map((section, index) => `<section class="scroll-copy ${index === 0 ? "visible" : ""}" data-copy="${index}"><span class="overline">${String(index + 1).padStart(2, "0")} / ${escapeHtml(section.kind)}</span><${index === 0 ? "h1" : "h2"}>${escapeHtml(section.heading)}</${index === 0 ? "h1" : "h2"}><p>${escapeHtml(section.summary)}</p>${index === sections.length - 1 ? `<a href="${escapeHtml(actionUrl)}">Continue ↗</a>` : ""}</section>`).join("");
}

function buildSchemas(project: EditorProject, heroVideo?: string, poster?: string) {
  const intake = project.intake!;
  const organizationType = intake.siteKind === "restaurant" ? "Restaurant" : intake.siteKind === "service" ? "LocalBusiness" : "Organization";
  const schemas: Record<string, unknown>[] = [
    { "@context": "https://schema.org", "@type": organizationType, name: intake.brandName, url: intake.sourceUrl, description: intake.description, sameAs: intake.socialLinks },
    { "@context": "https://schema.org", "@type": "WebSite", name: intake.brandName, url: intake.sourceUrl, description: intake.description },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: intake.answer.faqs.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }
  ];
  if (heroVideo) schemas.push({ "@context": "https://schema.org", "@type": "VideoObject", name: `${intake.brandName} animated experience`, description: intake.description, contentUrl: heroVideo, thumbnailUrl: poster, uploadDate: project.generated?.generatedAt });
  if (intake.hasCommerce && intake.products.length) schemas.push({ "@context": "https://schema.org", "@type": "ItemList", itemListElement: intake.products.slice(0, 12).map((product, index) => ({ "@type": "ListItem", position: index + 1, url: product.purchaseUrl, name: product.name })) });
  return schemas;
}

function buildRobots(project: EditorProject) {
  const origin = new URL(project.intake?.sourceUrl || "https://example.com").origin;
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

function buildSitemap(project: EditorProject) {
  const url = project.intake?.seo.canonicalUrl || project.intake?.sourceUrl || "https://example.com/";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeXml(url)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`;
}

function buildLlms(project: EditorProject) {
  const intake = project.intake!;
  const sections = intake.sections.filter((section) => project.recipe?.selectedSectionIds.includes(section.id)).slice(0, 8);
  return [`# ${intake.brandName}`, "", `> ${intake.answer.summary}`, "", "## Key facts", ...intake.answer.facts.map((fact) => `- ${fact}`), "", "## Main sections", ...sections.map((section) => `- [${section.heading}](${section.sourceUrl}): ${section.summary}`), "", "## Available actions", ...intake.actions.map((action) => `- [${action.label}](${action.url})`), "", `Source: ${intake.sourceUrl}`].join("\n");
}

function buildMcpActions(project: EditorProject) {
  const intake = project.intake!;
  return { version: "draft-2026-02", site: intake.sourceUrl, note: "Declarative discovery manifest. Browser support varies.", actions: intake.actions.map((action) => ({ id: action.id, name: action.label, description: `${action.label} on ${intake.brandName}`, method: "link", endpoint: action.url })) };
}

function buildSiteData(project: EditorProject) {
  const intake = project.intake!;
  return {
    name: intake.brandName,
    type: intake.siteKind,
    source: intake.sourceUrl,
    summary: intake.answer.summary,
    sections: intake.sections,
    actions: intake.actions,
    visuals: {
      sourceImages: project.assets.filter((asset) => asset.purpose === "reference").length,
      generatedBrandScenes: project.assets.filter((asset) => asset.purpose === "generated").length,
      productImagePolicy: "Source-store product images only"
    },
    seoAudit: intake.seo,
    generatedAt: project.generated?.generatedAt
  };
}

function buildReadme(project: EditorProject) {
  const generatedScenes = project.assets.filter((asset) => asset.purpose === "generated").length;
  const visualSource = generatedScenes
    ? `Irie Animate created ${generatedScenes} branded editorial scenes because the source site needed more usable imagery.`
    : "Irie Animate used public images from the source website.";
  return `# ${project.name} animated website\n\nGenerated locally by Irie Animate. ${visualSource} No external animation API was used.\n\n## View locally\n\n\`\`\`bash\npython3 -m http.server 8080\n\`\`\`\n\nOpen http://localhost:8080.\n\n## Search foundation\n\nThe package includes technical metadata, JSON-LD, robots.txt, sitemap.xml, llms.txt, answer-ready FAQ content, and a draft mcp-actions.json discovery manifest. These are technical foundations, not a promise of rankings or AI citations.\n`;
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function escapeHtml(value: string) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeXml(value: string) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}
