import { load } from "cheerio";
import type { StorefrontProduct, WebsiteAction, WebsiteIntake, WebsiteMedia, WebsitePage, WebsiteSection, WebsiteSectionKind } from "./projectStore";

const PRICE_PATTERN = /[$£€]\s?\d+(?:[,.]\d{2})?/;
const HEX_PATTERN = /#[0-9a-fA-F]{6}\b/g;
const SKIP_LINK = /login|account|cart|privacy|terms|policy|search|cdn-cgi|wp-json|feed/i;

export async function importWebsite(rawUrl: string): Promise<WebsiteIntake> {
  const sourceUrl = normalizeUrl(rawUrl);
  const origin = new URL(sourceUrl).origin;
  const homeHtml = await fetchHtml(sourceUrl);
  const home = load(homeHtml);
  const internalUrls = extractInternalLinks(home, origin, sourceUrl).slice(0, 6);
  const shopUrl = new URL("/shop", origin).toString();
  const urls = [...new Set([sourceUrl, ...internalUrls, shopUrl])].slice(0, 8);
  const fetched = await Promise.all(urls.map(async (url) => ({ url, html: url === sourceUrl ? homeHtml : await fetchHtml(url).catch(() => "") })));
  const documents = fetched.filter((item) => item.html.length > 100).map((item) => ({ ...item, $: load(item.html) }));
  const title = clean(home("meta[property='og:site_name']").attr("content"))
    || clean(home("title").text().split(/[—|]/)[0])
    || new URL(sourceUrl).hostname.replace(/^www\./, "");
  const headline = clean(home("h1").first().text()) || `Meet ${title}`;
  const description = clean(home("meta[name='description']").attr("content"))
    || clean(home("main p").first().text())
    || clean(home("p").first().text())
    || `${title} website`;
  const pages = documents.map((document, index) => extractPage(document.$, document.url, index));
  const media = extractMedia(documents).slice(0, 80);
  const products = extractProducts(documents, origin).slice(0, 60);
  const productNames = new Set(products.map((product) => comparable(product.name)));
  const sections = extractSections(documents, title, headline, description)
    .filter((section) => section.kind === "hero" || !productNames.has(comparable(section.heading)))
    .slice(0, 24);
  const actions = extractActions(documents, origin);
  const combinedText = documents.map((document) => document.$.text()).join(" ");
  const hasCommerce = products.length > 0 || /add to cart|checkout|shop now|buy now/i.test(combinedText);
  const siteKind = detectSiteKind(combinedText, hasCommerce);
  const canonicalUrl = absoluteHttpUrl(home("link[rel='canonical']").attr("href"), origin) || sourceUrl;
  const schemaTypes = extractSchemaTypes(documents);
  const homeImages = home("img").toArray();
  const imagesWithAlt = homeImages.filter((image) => clean(home(image).attr("alt"))).length;
  const h1Count = home("h1").length;
  const seoIssues = [
    !clean(home("title").text()) ? "Missing page title" : "",
    !clean(home("meta[name='description']").attr("content")) ? "Missing meta description" : "",
    h1Count !== 1 ? `Homepage has ${h1Count} H1 elements` : "",
    homeImages.length > 0 && imagesWithAlt < homeImages.length ? `${homeImages.length - imagesWithAlt} homepage images are missing alt text` : "",
    !canonicalUrl ? "Missing canonical URL" : "",
    schemaTypes.length === 0 ? "No JSON-LD structured data detected" : ""
  ].filter(Boolean);
  const answerFacts = sections.slice(0, 6).map((section) => `${section.heading}: ${section.summary}`).filter((fact) => fact.length > 4);
  const faqs = buildFaqs(title, description, sections, actions);

  return {
    sourceUrl,
    shopUrl: hasCommerce ? shopUrl : sourceUrl,
    brandName: title,
    headline,
    description,
    siteKind,
    hasCommerce,
    palette: detectPalette(combinedText, documents.map((document) => document.html).join("\n")),
    pages,
    sections,
    media,
    products,
    actions,
    socialLinks: extractSocialLinks(home, origin),
    seo: {
      sourceTitle: clean(home("title").text()),
      sourceDescription: clean(home("meta[name='description']").attr("content")),
      canonicalUrl,
      h1Count,
      imagesWithAlt,
      totalImages: homeImages.length,
      schemaTypes,
      issues: seoIssues
    },
    answer: { summary: description, facts: answerFacts, faqs },
    importedAt: new Date().toISOString()
  };
}

export const importStorefront = importWebsite;

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "IrieAnimate/3.0 website transformation engine" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Could not read ${url} (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error(`${url} is not an HTML page.`);
  return response.text();
}

function extractInternalLinks($: ReturnType<typeof load>, origin: string, sourceUrl: string) {
  const links = new Set<string>();
  $("nav a[href], header a[href], main a[href]").each((_, element) => {
    const url = absoluteHttpUrl($(element).attr("href"), origin);
    if (!url || new URL(url).origin !== origin || url === sourceUrl || SKIP_LINK.test(url)) return;
    links.add(url.split("#")[0]);
  });
  return [...links];
}

function extractPage($: ReturnType<typeof load>, url: string, index: number): WebsitePage {
  return {
    id: slug(`${clean($("title").text()) || `page-${index + 1}`}-${index}`),
    url,
    title: clean($("title").text().split(/[—|]/)[0]) || new URL(url).pathname,
    description: clean($("meta[name='description']").attr("content")) || clean($("main p").first().text()),
    headings: $("h1,h2,h3").toArray().map((node) => clean($(node).text())).filter(Boolean).slice(0, 20),
    imageUrls: extractDocumentImageUrls($, new URL(url).origin).slice(0, 20)
  };
}

function extractSections(documents: Array<{ url: string; html: string; $: ReturnType<typeof load> }>, brand: string, headline: string, description: string): WebsiteSection[] {
  const sections: WebsiteSection[] = [{ id: "hero", title: "Hero", heading: headline, summary: description, body: description, kind: "hero", imageUrls: [], sourceUrl: documents[0]?.url || "" }];
  const seen = new Set([headline.toLowerCase()]);
  for (const document of documents) {
    const { $, url } = document;
    const candidates = $("main section, main article, body > section, [role='main'] section").toArray();
    const nodes = candidates.length ? candidates : $("main h2, main h3, body h2").toArray().map((heading) => $(heading).parent().get(0)).filter(Boolean);
    for (const node of nodes) {
      const container = $(node!);
      const heading = clean(container.find("h1,h2,h3").first().text());
      const body = clean(container.find("p").toArray().map((paragraph) => $(paragraph).text()).join(" ")).slice(0, 900);
      if ((!heading && !body) || seen.has((heading || body).toLowerCase())) continue;
      const label = heading || body.slice(0, 72) || brand;
      seen.add(label.toLowerCase());
      const sectionImages = new Set<string>();
      container.find("img").each((_, imageNode) => {
        const image = $(imageNode);
        const imageUrl = decodeImageUrl(image.attr("src") || firstSrcsetUrl(image.attr("srcset")), new URL(url).origin);
        if (imageUrl && !/logo|icon|avatar|pixel|tracking/i.test(`${imageUrl} ${image.attr("alt") || ""}`)) sectionImages.add(imageUrl);
      });
      sections.push({
        id: slug(`${label}-${sections.length}`),
        title: heading || `Section ${sections.length + 1}`,
        heading: heading || label,
        summary: body.slice(0, 260) || heading,
        body: body || heading,
        kind: classifySection(`${heading} ${body}`),
        imageUrls: [...sectionImages].slice(0, 8),
        sourceUrl: url
      });
      if (sections.length >= 24) return sections;
    }
  }
  return sections;
}

function extractMedia(documents: Array<{ url: string; $: ReturnType<typeof load> }>): WebsiteMedia[] {
  const media = new Map<string, WebsiteMedia>();
  for (const document of documents) {
    const origin = new URL(document.url).origin;
    const ogImage = absoluteHttpUrl(document.$("meta[property='og:image']").attr("content"), origin);
    if (ogImage) media.set(ogImage, { id: slug(`media-${media.size}-${ogImage}`), url: ogImage, alt: "Featured image", sourceUrl: document.url });
    document.$("img").each((_, element) => {
      const image = document.$(element);
      const url = decodeImageUrl(image.attr("src") || firstSrcsetUrl(image.attr("srcset")), origin);
      if (!url || media.has(url) || /logo|icon|avatar|pixel|tracking/i.test(`${url} ${image.attr("alt") || ""}`)) return;
      media.set(url, { id: slug(`media-${media.size}-${image.attr("alt") || url}`), url, alt: clean(image.attr("alt")) || "Website image", sourceUrl: document.url });
    });
  }
  return [...media.values()];
}

function extractProducts(documents: Array<{ $: ReturnType<typeof load> }>, origin: string): StorefrontProduct[] {
  const products = new Map<string, StorefrontProduct>();
  for (const document of documents) {
    document.$("a[href*='/products/'], a[href*='/product/']").each((_, element) => {
      const anchor = document.$(element);
      const href = anchor.attr("href");
      if (!href) return;
      const purchaseUrl = new URL(href, origin).toString();
      if (products.has(purchaseUrl)) return;
      const image = anchor.find("img").first();
      const imageUrl = decodeImageUrl(image.attr("src") || firstSrcsetUrl(image.attr("srcset")), origin);
      if (!imageUrl) return;
      const text = clean(anchor.text());
      const price = text.match(PRICE_PATTERN)?.[0]?.replace(/\s/g, "") || "";
      const name = clean(image.attr("alt")) || clean(text.replace(PRICE_PATTERN, "").replace(/Shop Now|Quick Add|View product|→|\+/gi, " ")) || `Product ${products.size + 1}`;
      products.set(purchaseUrl, { id: slug(`${name}-${products.size + 1}`), name, price, imageUrl, purchaseUrl });
    });
  }
  return [...products.values()];
}

function extractActions(documents: Array<{ url: string; $: ReturnType<typeof load> }>, origin: string): WebsiteAction[] {
  const actions = new Map<string, WebsiteAction>();
  for (const document of documents) {
    document.$("a[href]").each((_, element) => {
      const anchor = document.$(element);
      const label = clean(anchor.text());
      const url = absoluteHttpUrl(anchor.attr("href"), origin);
      const match = label.match(/book|reserve|contact|get quote|request|buy|shop|subscribe|newsletter|visit/i);
      if (!url || !label || !match || actions.has(url) || /\/products?\//i.test(new URL(url).pathname)) return;
      actions.set(url, { id: slug(label), label, url, kind: /book|reserve/i.test(match[0]) ? "book" : /buy|shop/i.test(match[0]) ? "buy" : /subscribe|newsletter/i.test(match[0]) ? "subscribe" : /contact|quote|request/i.test(match[0]) ? "contact" : "visit" });
    });
  }
  return [...actions.values()].slice(0, 12);
}

function buildFaqs(brand: string, description: string, sections: WebsiteSection[], actions: WebsiteAction[]) {
  const faqs = [{ question: `What is ${brand}?`, answer: description }];
  for (const section of sections.filter((item) => item.kind === "services" || item.kind === "about" || item.kind === "content").slice(0, 3)) {
    if (section.summary.length >= 30 && comparable(section.summary) !== comparable(section.heading)) faqs.push({ question: `What should I know about ${section.heading}?`, answer: section.summary });
  }
  const action = actions.find((item) => item.kind === "contact" || item.kind === "book");
  if (action) faqs.push({ question: `How can I ${action.label.toLowerCase()}?`, answer: `Use the ${action.label} link on the website to continue.` });
  return faqs.slice(0, 5);
}

function classifySection(text: string): WebsiteSectionKind {
  if (/contact|book|reserve|location|hours|visit|quote|ride|appointment/i.test(text)) return "contact";
  if (/shop|product|collection|add to cart|buy now/i.test(text)) return "commerce";
  if (/service|solution|what we do|offer/i.test(text)) return "services";
  if (/testimonial|review|trusted|client|award/i.test(text)) return "proof";
  if (/gallery|portfolio|project|work/i.test(text)) return "gallery";
  if (/about|story|mission|vision|who we are/i.test(text)) return "about";
  return "content";
}

function detectSiteKind(text: string, hasCommerce: boolean): WebsiteIntake["siteKind"] {
  if (hasCommerce) return "commerce";
  if (/transportation|shuttle|chauffeur|car service|airport ride|book a ride|service|book now|get quote|appointment/i.test(text)) return "service";
  if (/restaurant|food menu|chef|dining|table reservation/i.test(text)) return "restaurant";
  if (/portfolio|selected work|case stud|creative director|designer|photographer/i.test(text)) return "portfolio";
  if (/article|blog|news|subscribe/i.test(text)) return "publisher";
  if (/company|business|team|solutions/i.test(text)) return "business";
  return "other";
}

function extractSchemaTypes(documents: Array<{ $: ReturnType<typeof load> }>) {
  const types = new Set<string>();
  for (const document of documents) {
    document.$("script[type='application/ld+json']").each((_, element) => {
      const raw = document.$(element).text();
      for (const match of raw.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.add(match[1]);
    });
  }
  return [...types];
}

function extractDocumentImageUrls($: ReturnType<typeof load>, origin: string) {
  const urls = new Set<string>();
  $("img").each((_, element) => {
    const image = $(element);
    const url = decodeImageUrl(image.attr("src") || firstSrcsetUrl(image.attr("srcset")), origin);
    if (url && !/logo|icon|avatar|pixel|tracking/i.test(`${url} ${image.attr("alt") || ""}`)) urls.add(url);
  });
  return [...urls];
}

function extractSocialLinks($: ReturnType<typeof load>, origin: string) {
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const url = absoluteHttpUrl($(element).attr("href"), origin);
    if (url && /instagram\.com|tiktok\.com|youtube\.com|facebook\.com|x\.com|twitter\.com|linkedin\.com/i.test(url)) links.add(url);
  });
  return [...links].slice(0, 8);
}

function detectPalette(text: string, html: string) {
  if (/reggae|rasta|one love|irie/i.test(text)) return ["#0A0A08", "#148942", "#FFD51F", "#ED2C25"];
  const counts = new Map<string, number>();
  for (const color of html.match(HEX_PATTERN) ?? []) {
    const normalized = color.toUpperCase();
    if (normalized === "#FFFFFF" || normalized === "#000000") continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const found = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([color]) => color);
  return ["#0A0A08", ...found, "#F2EEE5"].slice(0, 4);
}

function decodeImageUrl(value: string | undefined, origin: string) {
  if (!value || value.startsWith("data:")) return "";
  const absolute = new URL(value.replaceAll("&amp;", "&"), origin);
  if (absolute.pathname.includes("/_next/image")) {
    const nested = absolute.searchParams.get("url");
    if (nested) return new URL(nested, origin).toString();
  }
  return /^https?:$/.test(absolute.protocol) ? absolute.toString() : "";
}

function absoluteHttpUrl(value: string | undefined, origin: string) {
  if (!value || value.startsWith("#") || /^(mailto|tel|javascript):/i.test(value)) return "";
  try {
    const url = new URL(value, origin);
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function firstSrcsetUrl(value: string | undefined) {
  return value?.split(",")[0]?.trim().split(/\s+/)[0];
}

function normalizeUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Use an http or https website URL.");
  url.hash = "";
  return url.toString();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "item";
}

function clean(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function comparable(value: string) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
