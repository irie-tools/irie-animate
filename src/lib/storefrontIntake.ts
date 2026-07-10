import { load } from "cheerio";
import type { StorefrontIntake, StorefrontProduct } from "./projectStore";

const PRICE_PATTERN = /\$\s?\d+(?:\.\d{2})?/;
const HEX_PATTERN = /#[0-9a-fA-F]{6}\b/g;

export async function importStorefront(rawUrl: string): Promise<StorefrontIntake> {
  const sourceUrl = normalizeUrl(rawUrl);
  const origin = new URL(sourceUrl).origin;
  const shopUrl = new URL("/shop", origin).toString();
  const [homeHtml, shopHtml] = await Promise.all([
    fetchHtml(sourceUrl),
    fetchHtml(shopUrl).catch(() => "")
  ]);

  const home = load(homeHtml);
  const shop = load(shopHtml || homeHtml);
  const title = clean(home("meta[property='og:site_name']").attr("content"))
    || clean(home("title").text().split(/[—|]/)[0])
    || new URL(sourceUrl).hostname.replace(/^www\./, "");
  const headline = clean(home("h1").first().text()) || `Meet ${title}`;
  const description = clean(home("meta[name='description']").attr("content"))
    || clean(home("main p").first().text())
    || clean(home("p").first().text());
  const products = extractProducts(shop, origin).slice(0, 60);
  const combinedText = `${home.text()} ${shop.text()}`;

  return {
    sourceUrl,
    shopUrl,
    brandName: title,
    headline,
    description,
    palette: detectPalette(combinedText, `${homeHtml}\n${shopHtml}`),
    products,
    socialLinks: extractSocialLinks(home, origin),
    importedAt: new Date().toISOString()
  };
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "IrieAnimate/2.0 storefront importer"
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Could not read ${url} (${response.status}).`);
  return response.text();
}

function extractProducts($: ReturnType<typeof load>, origin: string): StorefrontProduct[] {
  const products = new Map<string, StorefrontProduct>();
  $("a[href*='/products/']").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    if (!href) return;
    const purchaseUrl = new URL(href, origin).toString();
    if (products.has(purchaseUrl)) return;
    const image = anchor.find("img").first();
    const imageUrl = decodeImageUrl(image.attr("src") || firstSrcsetUrl(image.attr("srcset")), origin);
    if (!imageUrl) return;
    const text = clean(anchor.text());
    const price = text.match(PRICE_PATTERN)?.[0]?.replace(/\s/g, "") || "";
    const rawName = clean(image.attr("alt")) || clean(text.replace(PRICE_PATTERN, "").replace(/Shop Now|Quick Add|View product|→|\+/gi, " "));
    const name = clean(rawName.replace(/^(T-Shirt|Hoodie|Sweatshirt|Tank Top|Crewneck|Crop Top)\s+/i, ""));
    const category = text.match(/\b(T-Shirt|Hoodie|Sweatshirt|Tank Top|Crewneck|Crop Top)\b/i)?.[0];
    products.set(purchaseUrl, {
      id: slug(`${name}-${products.size + 1}`),
      name: name || `Product ${products.size + 1}`,
      price,
      imageUrl,
      purchaseUrl,
      category
    });
  });
  return [...products.values()];
}

function extractSocialLinks($: ReturnType<typeof load>, origin: string) {
  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const url = new URL(href, origin).toString();
    if (/instagram\.com|tiktok\.com|youtube\.com|facebook\.com|x\.com|twitter\.com/i.test(url)) links.add(url);
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
  if (!value) return "";
  const absolute = new URL(value.replaceAll("&amp;", "&"), origin);
  if (absolute.pathname.includes("/_next/image")) {
    const nested = absolute.searchParams.get("url");
    if (nested) return new URL(nested, origin).toString();
  }
  return absolute.toString();
}

function firstSrcsetUrl(value: string | undefined) {
  return value?.split(",")[0]?.trim().split(/\s+/)[0];
}

function normalizeUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Use an http or https storefront URL.");
  url.hash = "";
  return url.toString();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "product";
}

function clean(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
