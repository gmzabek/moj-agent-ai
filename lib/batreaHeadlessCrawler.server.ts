import { chromium } from "playwright";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const productPath = /\/(produkt|produkty|sklep|product)\b/i;

export type CrawledBatreaProduct = {
  name: string;
  url: string;
  category: string;
  fullDescription: string;
  price: string;
  technicalSpecification: string;
  images: string[];
  variants: string[];
  documentsPdf: string[];
  additionalInformation: string;
};

function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }

export async function crawlBatrea(maxProducts = 20) {
  const robots = await fetch("https://m.batrea.com/robots.txt").then((response) => response.text()).catch(() => "");
  if (/^Disallow:\s*\/$/mi.test(robots)) throw new Error("robots.txt blokuje crawling strony.");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: "AgentAI-Batrea-Crawler/1.0" });
  try {
    await page.goto("https://m.batrea.com/pl/produkty", { waitUntil: "networkidle", timeout: 45_000 });
    const links = unique(await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href).filter((href) => /\/(produkt|produkty|sklep|product)\b/i.test(href)))).slice(0, maxProducts);
    const products: CrawledBatreaProduct[] = [];
    for (const url of links) {
      await wait(1_000);
      await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
      products.push(await page.evaluate(() => {
        const text = (selector: string) => Array.from(document.querySelectorAll(selector)).map((element) => element.textContent?.trim() ?? "").filter(Boolean).join("\n");
        const links = (selector: string) => Array.from(document.querySelectorAll<HTMLAnchorElement>(selector)).map((element) => element.href).filter(Boolean);
        const images = Array.from(document.querySelectorAll<HTMLImageElement>("img")).map((image) => image.currentSrc || image.src).filter(Boolean);
        return { name: document.querySelector("h1")?.textContent?.trim() || document.title || "brak danych", url: location.href, category: text("nav[aria-label*=breadcrumb i], .breadcrumb, [class*=breadcrumb]") || "brak danych", fullDescription: text("main p, main li") || "brak danych", price: text("[class*=price], [data-price]") || "brak danych", technicalSpecification: text("table, dl, [class*=spec], [class*=technical]") || "brak danych", images: [...new Set(images)], variants: text("select option, [class*=variant]").split("\n").filter(Boolean), documentsPdf: links("a[href$='.pdf'], a[href*='.pdf?']"), additionalInformation: text("[class*=faq], [class*=additional], [class*=dowiesz]") || "brak danych" };
      }));
    }
    return { robots, products, crawledAt: new Date().toISOString() };
  } finally { await browser.close(); }
}
