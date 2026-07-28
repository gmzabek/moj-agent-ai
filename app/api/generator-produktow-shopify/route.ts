import { google } from "@ai-sdk/google";
import { generateText, Output, stepCountIs } from "ai";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";
import { calculatorTool, readWebPageTool } from "../../../lib/researchTools.server";

export const runtime = "nodejs";
const missing = "brak danych – do uzupełnienia";
const enabledSearch = process.env.ENABLE_SEARCH_GROUNDING === "true";
const detailsSchema = z.object({ urls: z.array(z.string().url()).min(1).max(10), overrideName: z.string().max(180).default(""), technicalText: z.string().max(80_000).default("") });
const productSchema = z.object({
  sourceUrl: z.string(), title: z.string(), descriptionHtml: z.string(), vendor: z.string(), type: z.string(), tags: z.string(), categoryName: z.string(), categoryId: z.string(), collections: z.string(), breadcrumbs: z.string(),
  images: z.array(z.object({ url: z.string(), alt: z.string(), kind: z.string() })),
  variants: z.array(z.object({ option1Name: z.string(), option1Value: z.string(), option2Name: z.string(), option2Value: z.string(), option3Name: z.string(), option3Value: z.string(), sku: z.string(), barcode: z.string(), price: z.string(), compareAtPrice: z.string(), cost: z.string(), weight: z.string(), weightUnit: z.string() })),
  metafields: z.array(z.object({ namespace: z.string(), key: z.string(), value: z.string(), type: z.string() })),
  seo: z.object({ titleTag: z.string(), descriptionTag: z.string(), handle: z.string() }), gaps: z.array(z.string()),
});
const matrixifySchema = z.object({ products: z.array(productSchema).min(1), matrixifyRows: z.array(z.record(z.string(), z.string())).min(1) });

async function pdfText(file: File) {
  if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: dozwolony jest PDF do 10 MB.`);
  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
  try { return (await parser.getText()).text.slice(0, 40_000); } finally { await parser.destroy(); }
}

const researchSystem = `Jesteś analitykiem danych produktów. Używaj tylko danych z URL-i i TEKSTU PDF; PDF jest tekstem, nie renderuj ani nie analizuj jego obrazów. Dla każdego URL wywołaj readWebPage, zbierz opis, dane techniczne, ceny, warianty, breadcrumb oraz wszystkie URL-e zdjęć i rysunków/schematów dostępne w HTML/JSON-LD. Google Search wyłącznie dla brakujących norm, calculator dla konwersji. Nie wymyślaj danych: użyj dokładnie "${missing}". Wszystkie jednostki metryczne. Po zakończeniu narzędzi oddaj zwięzły raport faktów dla każdego URL, bez JSON.`;
const generationSystem = `Jesteś specjalistą Shopify/Matrixify. Używaj wyłącznie raportu researchu i TEKSTU PDF podanego w prompcie. Braki zapisuj dokładnie jako "${missing}". Wszystkie jednostki metryczne.
Wynik ma zawierać listę products oraz matrixifyRows. descriptionHtml 300-600 słów, przepisany, h2/h3 i ul/li. title max 60; SEO title 60-70, opis 155-160; handle slug bez products/. matrixifyRows musi zawierać kolumny: Handle,Command,Title,Body HTML,Vendor,Type,Tags,Category: ID,Category: Name,Custom Collections,Image Src,Image Position,Image Alt Text,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Barcode,Variant Price,Variant Compare At Price,Variant Cost,Variant Weight,Variant Weight Unit,Metafield: seo.title_tag [string],Metafield: seo.description_tag [string],Status,Published oraz wszystkie metapola custom. Jeden wiersz per wariant/zdjęcie, Command=MERGE, Status=Draft, Published=FALSE.`;

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null); if (!auth) return Response.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return Response.json({ error: "Brak GOOGLE_GENERATIVE_AI_API_KEY." }, { status: 500 });
  try {
    const form = await request.formData(); const details = detailsSchema.parse({ urls: String(form.get("urls") ?? "").split(/\r?\n/).map(x => x.trim()).filter(Boolean), overrideName: String(form.get("overrideName") ?? ""), technicalText: String(form.get("technicalText") ?? "") });
    const files = form.getAll("pdfs").filter((x): x is File => x instanceof File && x.size > 0);
    const pdfs = await Promise.all(files.map(async file => `PDF: ${file.name}\n${await pdfText(file)}`));
    const sourceInput = `URL-e:\n${details.urls.join("\n")}\nNadpisanie modelu: ${details.overrideName || "brak"}\nDane techniczne wklejone:\n${details.technicalText || "brak"}\n${pdfs.join("\n\n") || "Brak PDF"}`;
    const research = await generateText({ model: google("gemini-3.1-flash-lite"), system: researchSystem, prompt: sourceInput, tools: { readWebPage: readWebPageTool, calculator: calculatorTool, ...(enabledSearch ? { google_search: google.tools.googleSearch({}) } : {}) }, stopWhen: stepCountIs(16), maxRetries: 1, temperature: .1 });
    if (!research.text.trim()) throw new Error("Nie udało się pobrać danych źródłowych produktu.");
    const result = await generateText({ model: google("gemini-3.1-flash-lite"), system: generationSystem, prompt: `${sourceInput}\n\nRAPORT RESEARCHU:\n${research.text.slice(0, 60_000)}`, output: Output.object({ schema: matrixifySchema }), maxRetries: 1, temperature: .1 });
    if (!result.output) throw new Error("Model nie zwrócił danych Matrixify.");
    return Response.json(result.output);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Nie udało się przetworzyć danych." }, { status: 500 }); }
}
