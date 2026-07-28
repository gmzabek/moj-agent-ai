import { PDFParse } from "pdf-parse";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;
const maxProducts = 12;

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function absolute(base: string, value: string) { try { return new URL(value, base).toString(); } catch { return null; } }
function urls(html: string, base: string, pattern: RegExp) { return [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map((m) => absolute(base, m[1])).filter((value): value is string => Boolean(value && pattern.test(value))).filter((value, index, list) => list.indexOf(value) === index); }
async function fetchPage(url: string) { const wait = Math.max(0, 1_000 - (Date.now() - lastRequestAt)); if (wait) await delay(wait); lastRequestAt = Date.now(); const response = await fetch(url, { headers: { "User-Agent": "AgentAI-Batrea-Crawler/1.0" }, cache: "no-store" }); if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`); return response.text(); }
async function readPdf(url: string) { try { const response = await fetch(url, { headers: { "User-Agent": "AgentAI-Batrea-Crawler/1.0" } }); if (!response.ok) return "brak danych"; const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) }); try { return (await parser.getText()).text.slice(0, 40_000); } finally { await parser.destroy(); } } catch { return "brak danych"; } }
export type BatreaSource = { name: string; url: string; category: string; fullDescription: string; price: string; images: string[]; drawings: string[]; pdfTexts: string[]; additionalInfo: string; };
export async function crawlBatrea(startUrls: string[]) {
  const roots = startUrls.map((value) => new URL(value));
  if (roots.some((url) => !url.hostname.endsWith("batrea.com"))) throw new Error("Tryb Batrea obsługuje wyłącznie adresy batrea.com.");
  const robots = await fetchPage(`${roots[0].origin}/robots.txt`).catch(() => "");
  const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map((match) => match[1]);
  const allowed = (url: string) => !disallowed.some((path) => path !== "/" && new URL(url).pathname.startsWith(path));
  const candidates = new Set<string>();
  for (const root of roots) { if (!allowed(root.toString())) continue; const html = await fetchPage(root.toString()); candidates.add(root.toString()); urls(html, root.toString(), /\/(produkt|sklep|product)\//i).forEach((url) => { if (allowed(url)) candidates.add(url); }); }
  const result: BatreaSource[] = [];
  for (const url of [...candidates].slice(0, maxProducts)) { const html = await fetchPage(url); const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "brak danych"; const text = cleanHtml(html); const pdfUrls = urls(html, url, /\.pdf(?:$|\?)/i); const allImages = urls(html, url, /\.(?:png|jpe?g|webp|svg)(?:$|\?)/i); result.push({ name: cleanHtml(title), url, category: text.match(/(?:breadcrumb|okruszki)[\s\S]{0,500}/i)?.[0] ?? "brak danych", fullDescription: text, price: text.match(/\d[\d\s.,]*\s?(?:zł|PLN|EUR)/i)?.[0] ?? "brak danych", images: allImages.filter((image) => !/rys|schemat|drawing|technic/i.test(image)), drawings: allImages.filter((image) => /rys|schemat|drawing|technic/i.test(image)), pdfTexts: await Promise.all(pdfUrls.map(readPdf)), additionalInfo: text.match(/(?:Dowiesz się|FAQ|informacje dodatkowe)[\s\S]{0,2000}/i)?.[0] ?? "brak danych" }); }
  return result;
}
