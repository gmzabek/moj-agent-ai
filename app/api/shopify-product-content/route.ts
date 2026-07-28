import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { z } from "zod";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().max(180),
  sourceUrl: z.string().url().max(2_000).optional().or(z.literal("")),
  sourceText: z.string().trim().max(50_000).optional().default(""),
});

const missing = "brak danych – do uzupełnienia";

const system = `Jesteś polskim specjalistą e-commerce i SEO copywriterem dla sejfów oraz systemów zabezpieczeń.
Bazuj wyłącznie na danych przekazanych przez użytkownika i pobranej treści źródłowej. Nie używaj wiedzy własnej do uzupełniania faktów. Każdą niedostępną wartość wpisuj dokładnie: "${missing}". Wszystkie liczby podawaj w jednostkach metrycznych.

Zwróć wyłącznie Markdown gotowy do wklejenia do Shopify Admin lub Matrixify, w tej kolejności:
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

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
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

    const result = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system,
      prompt: `Nazwa/model: ${parsed.data.name || missing}\nDane wklejone: ${parsed.data.sourceText || missing}\nTreść strony źródłowej: ${pageText || missing}`,
      temperature: 0.2,
      maxRetries: 1,
    });

    return Response.json({ content: result.text });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się wygenerować treści." }, { status: 500 });
  }
}
