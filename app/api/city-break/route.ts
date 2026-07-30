import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

export const runtime = "nodejs";

// AI SDK 5 uses stopWhen as the supported equivalent of maxSteps: 3.
const maxSteps = 3;
const isSearchGroundingEnabled = process.env.ENABLE_SEARCH_GROUNDING === "true";

if (isSearchGroundingEnabled) {
  console.warn(
    "WARNING: Search Grounding is ENABLED. This is the most expensive API feature ($14/1000 requests). Use it only for tests and remove ENABLE_SEARCH_GROUNDING from .env.local afterwards.",
  );
}

const requestSchema = z.object({
  city: z.string().trim().min(2).max(80),
  days: z.number().int().min(1).max(2).default(2),
  travelers: z.number().int().min(1).max(4).default(2),
});

const systemPrompt = `Jesteś profesjonalnym asystentem podróży i lokalnym researcherem.
Tworzysz City Break Planner dla maksymalnie 2 dni i domyślnie dla 2 osób.

ZASADY JAKOŚCI DANYCH:
- Jeżeli narzędzie Google Search jest dostępne, korzystaj z niego dla aktualnych danych.
- Dla atrakcji preferuj oficjalne strony, muzea, instytucje miejskie i transport publiczny.
- Nie wymyślaj godzin otwarcia, cen ani linków. Jeśli nie możesz ich potwierdzić, napisz "orientacyjnie" albo "do weryfikacji".
- Nie wybieraj wyłącznie najbardziej oczywistych atrakcji. Preferuj wartościowe miejsca, lokalne dzielnice, muzea, architekturę, parki, galerie i mniej banalne punkty.
- Gastronomia: unikaj sieciówek i tourist traps. Preferuj lokalne, autentyczne miejsca z dobrą opinią mieszkańców.
- Preferuj komunikację miejską, pieszo tylko gdy dystans jest rozsądny, Uber/Bolt tylko gdy realnie oszczędza czas lub nogi.

WYNIK ZAWSZE W TEJ KOLEJNOŚCI:
1. Podsumowanie wyjazdu
2. Harmonogram
3. Atrakcje
4. Transport
5. Restauracje
6. Kosztorys
7. Dobre rady

W każdej sekcji podawaj konkrety. Dla każdej atrakcji podaj: nazwę, krótki opis, orientacyjny czas zwiedzania, godziny otwarcia, cenę biletu dla grupy, oficjalny link jeśli istnieje.
Dla transportu między kolejnymi punktami podaj: sposób, czas, orientacyjny koszt i odległość.
W kosztorysie podsumuj bilety, transport, jedzenie i łączny koszt dla całej grupy.`;

function getFriendlyError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Nie udało się wygenerować planu.";

  if (message.toLowerCase().includes("spending cap")) {
    return "Projekt Google AI przekroczył miesięczny limit wydatków. Zmień limit w AI Studio albo użyj innego klucza GOOGLE_GENERATIVE_AI_API_KEY w .env.local.";
  }

  return message;
}

async function readWebPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent": "CityBreakPlanner/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return `Nie udało się pobrać strony: HTTP ${response.status}.`;
    }

    const html = await response.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  } catch (error) {
    return error instanceof Error && error.name === "AbortError"
      ? "Nie udało się pobrać strony: timeout po 6 sekundach."
      : `Nie udało się pobrać strony: ${
          error instanceof Error ? error.message : "nieznany błąd"
        }.`;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      {
        error:
          "Brak GOOGLE_GENERATIVE_AI_API_KEY. Uzupełnij .env.local kluczem Google AI Studio.",
      },
      { status: 500 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      { error: "Podaj miasto oraz liczbę dni od 1 do 2." },
      { status: 400 },
    );
  }

  const { city, days, travelers } = parsed.data;

  try {
    const result = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: systemPrompt,
      prompt: `Przygotuj kompletny City Break Planner.

Miasto: ${city}
Liczba osób: ${travelers}
Liczba dni: ${days}

Uwzględnij maksymalnie ${days} ${
        days === 1 ? "dzień" : "dni"
      }. Jeżeli dane cenowe lub godziny otwarcia nie są pewne, oznacz je jako orientacyjne/do weryfikacji. W linkach podawaj przede wszystkim oficjalne strony.`,
      tools: {
        ...(isSearchGroundingEnabled
          ? { google_search: google.tools.googleSearch({}) }
          : {}),
        readWebPage: tool({
          description:
            "Czyta oficjalną stronę atrakcji, restauracji albo transportu, gdy trzeba potwierdzić ceny, godziny otwarcia lub adres.",
          inputSchema: z.object({
            url: z.string().url(),
          }),
          execute: async ({ url }) => readWebPage(url),
        }),
      },
      maxRetries: 1,
      stopWhen: stepCountIs(maxSteps),
      temperature: 0.25,
    });

    return Response.json({
      plan: result.text,
      city,
      days,
      travelers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: getFriendlyError(error) }, { status: 500 });
  }
}
