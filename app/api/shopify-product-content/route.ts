import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().max(180),
  sourceUrl: z.string().url().max(2_000).optional().or(z.literal("")),
  sourceText: z.string().trim().max(50_000).optional().default(""),
});

const missing = "brak danych – do uzupełnienia";

const matrixifyRowSchema = z.object({
  "Handle": z.string(),
  "Command": z.string(),
  "Title": z.string(),
  "Body HTML": z.string(),
  "Vendor": z.string(),
  "Type": z.string(),
  "Tags": z.string(),
  "Category: Name": z.string(),
  "Image Src": z.string(),
  "Image Position": z.string(),
  "Image Alt Text": z.string(),
  "Option1 Name": z.string(),
  "Option1 Value": z.string(),
  "Option2 Name": z.string(),
  "Option2 Value": z.string(),
  "Option3 Name": z.string(),
  "Option3 Value": z.string(),
  "Variant SKU": z.string(),
  "Variant Barcode": z.string(),
  "Variant Price": z.string(),
  "Variant Compare At Price": z.string(),
  "Variant Cost": z.string(),
  "Variant Weight": z.string(),
  "Variant Weight Unit": z.string(),
  "SEO Title": z.string(),
  "SEO Description": z.string(),
  "Status": z.string(),
  "Published": z.string(),
  "Metafield: custom.breadcrumbs": z.string(),
  "Metafield: custom.oswietlenie": z.string(),
  "Metafield: custom.dodatkowe_informacje": z.string(),
  "Metafield: custom.wysylka": z.string(),
  "Metafield: custom.rodzaj_zamka": z.string(),
  "Metafield: custom.rodzaj_broni": z.string(),
  "Metafield: custom.ognioodpornosc": z.string(),
  "Metafield: custom.wielkosc_sejfu": z.string(),
  "Metafield: custom.klasa_bezpieczenstwa": z.string(),
  "Metafield: custom.ilosc_uchwytow_na_bron": z.string(),
  "Metafield: custom.waga": z.string(),
  "Metafield: custom.wymiary_zewnetrzne": z.string(),
  "Metafield: custom.wymiary_wewnetrzne": z.string(),
  "Metafield: custom.klasa_antywlamaniowa": z.string(),
  "Metafield: custom.otwory_do_montazu": z.string(),
  "Metafield: custom.kat_otwarcia_drzwi": z.string(),
  "Metafield: custom.korpus": z.string(),
  "Metafield: custom.drzwi": z.string(),
  "Metafield: custom.rodzaj_zamkniecia": z.string(),
});

const responseSchema = z.object({
  content: z.string(),
  matrixifyRows: z.array(matrixifyRowSchema).min(1).max(50),
});

const system = `Jesteś polskim specjalistą e-commerce i SEO copywriterem dla sejfów oraz systemów zabezpieczeń.
Bazuj wyłącznie na danych przekazanych przez użytkownika i pobranej treści źródłowej. Nie używaj wiedzy własnej do uzupełniania faktów. Każdą niedostępną wartość wpisuj dokładnie: "${missing}". Wszystkie liczby podawaj w jednostkach metrycznych.

Zwróć obiekt zgodny ze schematem. Pole content ma zawierać wyłącznie Markdown gotowy do wklejenia do Shopify Admin lub Matrixify, w tej kolejności:
# Tytuł
Jeden tytuł w formacie [Marka] [Model] – [Kategoria] [Kluczowa cecha], maksymalnie 60 znaków i z główną frazą kluczową.
## Opis SEO
300–600 słów. Użyj nagłówków ###, krótkiego wstępu (korzyść + fraza kluczowa), listy cech w Markdown, sekcji zastosowanie/dla kogo oraz końcowego CTA. Przepisuj treść, nie kopiuj jej 1:1. Nie stosuj keyword stuffingu.
## Kategoria
Pełna ścieżka Shopify, oparta tylko na breadcrumbie lub danych źródłowych.
## Warianty
Tabela Markdown: Opcja | Wartości | SKU suffix. Gdy nie ma wariantów, zachowaj jeden wiersz z wartością "${missing}".
## Metapola produktu
Tabela Markdown: Metapole | Typ | Wartość. Ujmij każdą pozycję: Breadcrumbs, Oświetlenie, Dodatkowe informacje, Wysyłka, Rodzaj zamka, Powiązane produkty, Rodzaj broni, Ognioodporność, Wielkość sejfu, Klasa bezpieczeństwa, Ilość uchwytów na broń, Waga, Wymiary zewnętrzne, Wymiary wewnętrzne, Klasa antywłamaniowa, Otwory do montażu, Kąt otwarcia drzwi, Korpus, Drzwi, Rodzaj zamknięcia. Dla nowego koniecznego metapola dodaj osobny wiersz: Nazwa metapola | typ (tekst/liczba/lista/boolean) | namespace.key | uzasadnienie.
## Listing w wyszukiwarce
Podaj tabelę: Tytuł strony (60–70 znaków, fraza na początku, marka na końcu) | Opis meta (155–160 znaków: korzyść + wyróżnik + CTA) | Uchwyt URL. Handle ma zaczynać się od products/, być małymi literami z myślnikami i nie zawierać SKU ani dat.`;

function isPdf(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null && value.size > 0;
}

async function getRequestData(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null), pdfText: "" };
  }

  const formData = await request.formData();
  const pdfFile = formData.get("pdf");
  let pdfText = "";

  if (isPdf(pdfFile)) {
    if (pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Załącz plik w formacie PDF.");
    }
    if (pdfFile.size > 10 * 1024 * 1024) throw new Error("PDF może mieć maksymalnie 10 MB.");

    const parsePdf = (await import("pdf-parse")).default;
    const parsedPdf = await parsePdf(Buffer.from(await pdfFile.arrayBuffer()));
    pdfText = parsedPdf.text.trim().slice(0, 50_000);
    if (!pdfText) throw new Error("Nie udało się odczytać tekstu z załączonego PDF.");
  }

  return {
    body: {
      name: String(formData.get("name") || ""),
      sourceUrl: String(formData.get("sourceUrl") || ""),
      sourceText: String(formData.get("sourceText") || ""),
    },
    pdfText,
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000);
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });

  let requestData: { body: unknown; pdfText: string };
  try {
    requestData = await getRequestData(request);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się odczytać PDF." }, { status: 400 });
  }

  const parsed = schema.safeParse(requestData.body);
  if (!parsed.success) return Response.json({ error: "Podaj dane produktu lub poprawny URL." }, { status: 400 });

  try {
    let pageText = "";

    if (parsed.data.sourceUrl) {
      const sourceUrl = new URL(parsed.data.sourceUrl);
      if (!['http:', 'https:'].includes(sourceUrl.protocol) || sourceUrl.hostname === 'localhost') {
        throw new Error("Dozwolony jest wyłącznie publiczny adres HTTP/HTTPS.");
      }

      const response = await fetch(sourceUrl, {
        headers: { "User-Agent": "AgentAI-Shopify/1.0" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Źródło zwróciło HTTP ${response.status}.`);
      pageText = stripHtml(await response.text());
    }

    const result = await generateObject({
      model: google("gemini-3.1-flash-lite"),
      system,
      schema: responseSchema,
      prompt: `Nazwa/model: ${parsed.data.name || missing}\nDane wklejone: ${parsed.data.sourceText || missing}\nTekst z PDF: ${requestData.pdfText || missing}\nTreść strony źródłowej: ${pageText || missing}\nDla matrixifyRows przygotuj jeden wiersz dla każdego wariantu; gdy nie ma wariantów, jeden wiersz. Użyj Command=MERGE, Status=Draft, Published=FALSE. W "Body HTML" użyj poprawnego HTML z h2/h3/p/ul/li. Wszystkie klucze metapól zdefiniowane w schemacie muszą mieć wartość źródłową albo "${missing}".`,
      temperature: 0.2,
      maxRetries: 1,
    });

    return Response.json(result.object);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się wygenerować treści." }, { status: 500 });
  }
}
