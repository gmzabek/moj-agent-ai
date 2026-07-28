import { google } from "@ai-sdk/google";
import { generateText, Output, stepCountIs } from "ai";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";
import { calculatorTool, readWebPageTool } from "../../../lib/researchTools.server";

export const runtime = "nodejs";
export const maxDuration = 60;
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
const matrixifySchema = z.object({ products: z.array(productSchema).min(1) });
type GeneratedProduct = z.infer<typeof productSchema>;

async function pdfText(file: File) {
  if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: dozwolony jest PDF do 10 MB.`);
  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
  try { return (await parser.getText()).text.slice(0, 40_000); } finally { await parser.destroy(); }
}

const researchSystem = `Jesteś analitykiem danych produktów. Używaj tylko danych z URL-i i TEKSTU PDF; PDF jest tekstem, nie renderuj ani nie analizuj jego obrazów. Dla każdego URL wywołaj readWebPage, zbierz opis, dane techniczne, ceny, warianty, breadcrumb oraz wszystkie URL-e zdjęć i rysunków/schematów dostępne w HTML/JSON-LD. Google Search wyłącznie dla brakujących norm, calculator dla konwersji. Nie wymyślaj danych: użyj dokładnie "${missing}". Wszystkie jednostki metryczne. Po zakończeniu narzędzi oddaj zwięzły raport faktów dla każdego URL, bez JSON.`;
const generationSystem = `Jesteś specjalistą Shopify/Matrixify. Używaj wyłącznie raportu researchu i TEKSTU PDF podanego w prompcie. Braki zapisuj dokładnie jako "${missing}". Wszystkie jednostki metryczne.
Wynik ma zawierać wyłącznie listę products. descriptionHtml 300-600 słów, przepisany, h2/h3 i ul/li. title max 60; SEO title 60-70, opis 155-160; handle slug bez products/. Warianty, obrazy i metapola muszą być kompletne, ponieważ serwer utworzy z nich wiersze Matrixify.`;

function createMatrixifyRows(products: GeneratedProduct[]) {
  return products.flatMap((product) => {
    const variants = product.variants.length ? product.variants : [{ option1Name: "Title", option1Value: "Default Title", option2Name: "", option2Value: "", option3Name: "", option3Value: "", sku: missing, barcode: missing, price: missing, compareAtPrice: missing, cost: missing, weight: missing, weightUnit: "kg" }];
    const images = product.images.length ? product.images : [{ url: missing, alt: product.title, kind: "product" }];
    const rowCount = Math.max(variants.length, images.length);
    return Array.from({ length: rowCount }, (_, index) => {
      const variant = variants[index % variants.length];
      const image = images[index % images.length];
      const row: Record<string, string> = {
        Handle: product.seo.handle,
        Command: "MERGE",
        Title: index === 0 ? product.title : "",
        "Body HTML": index === 0 ? product.descriptionHtml : "",
        Vendor: product.vendor,
        Type: product.type,
        Tags: product.tags,
        "Category: ID": product.categoryId,
        "Category: Name": product.categoryName,
        "Custom Collections": product.collections,
        "Image Src": image.url,
        "Image Position": String(index + 1),
        "Image Alt Text": image.alt || product.title,
        "Option1 Name": variant.option1Name,
        "Option1 Value": variant.option1Value,
        "Option2 Name": variant.option2Name,
        "Option2 Value": variant.option2Value,
        "Option3 Name": variant.option3Name,
        "Option3 Value": variant.option3Value,
        "Variant SKU": variant.sku,
        "Variant Barcode": variant.barcode,
        "Variant Price": variant.price,
        "Variant Compare At Price": variant.compareAtPrice,
        "Variant Cost": variant.cost,
        "Variant Weight": variant.weight,
        "Variant Weight Unit": variant.weightUnit,
        "Metafield: seo.title_tag [string]": product.seo.titleTag,
        "Metafield: seo.description_tag [string]": product.seo.descriptionTag,
        Status: "Draft",
        Published: "FALSE",
      };
      for (const metafield of product.metafields) row[`Metafield: ${metafield.namespace}.${metafield.key} [${metafield.type}]`] = metafield.value;
      return row;
    });
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null); if (!auth) return Response.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return Response.json({ error: "Brak GOOGLE_GENERATIVE_AI_API_KEY." }, { status: 500 });
  try {
    const form = await request.formData(); const details = detailsSchema.parse({ urls: String(form.get("urls") ?? "").split(/\r?\n/).map(x => x.trim()).filter(Boolean), overrideName: String(form.get("overrideName") ?? ""), technicalText: String(form.get("technicalText") ?? "") });
    const files = form.getAll("pdfs").filter((x): x is File => x instanceof File && x.size > 0);
    const pdfs = await Promise.all(files.map(async file => `PDF: ${file.name}\n${await pdfText(file)}`));
    const sourceInput = `URL-e:\n${details.urls.join("\n")}\nNadpisanie modelu: ${details.overrideName || "brak"}\nDane techniczne wklejone:\n${details.technicalText || "brak"}\n${pdfs.join("\n\n") || "Brak PDF"}`;
    const research = await generateText({ model: google("gemini-3.1-flash-lite"), system: researchSystem, prompt: sourceInput, tools: { readWebPage: readWebPageTool, calculator: calculatorTool, ...(enabledSearch ? { google_search: google.tools.googleSearch({}) } : {}) }, stopWhen: stepCountIs(8), maxRetries: 1, temperature: .1 });
    if (!research.text.trim()) throw new Error("Nie udało się pobrać danych źródłowych produktu.");
    const result = await generateText({ model: google("gemini-3.1-flash-lite"), system: generationSystem, prompt: `${sourceInput}\n\nRAPORT RESEARCHU:\n${research.text.slice(0, 60_000)}`, output: Output.object({ schema: matrixifySchema }), maxRetries: 1, temperature: .1 });
    if (!result.output) throw new Error("Model nie zwrócił danych Matrixify.");
    return Response.json({ products: result.output.products, matrixifyRows: createMatrixifyRows(result.output.products) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Nie udało się przetworzyć danych." }, { status: 500 }); }
}
