import { google } from "@ai-sdk/google";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageChunk,
  tool,
  type UIMessage,
  type UIMessageChunk,
  type LanguageModelUsage,
  type ModelMessage,
  type UserContent,
} from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchKnowledgeBase } from "../../../lib/searchKnowledge.server";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";
import {
  getOrCreateUserProfile,
  getProfilePrompt,
  getRecentConversationMemory,
  isValidUserId,
  saveUserDetails,
  saveUserName,
  saveUserPreference,
  type StoredUserProfile,
  type ConversationMemoryMessage,
} from "../../../lib/userProfile.server";

type AiModel = "flash" | "pro";

const imageModels = ["gemini-3.1-flash-lite-image"];
const chatModelId = "gemini-3.1-flash-lite";
// AI SDK 5 uses stopWhen as the supported equivalent of maxSteps: 3.
const maxSteps = 3;
const isSearchGroundingEnabled = process.env.ENABLE_SEARCH_GROUNDING === "true";

if (isSearchGroundingEnabled) {
  console.warn(
    "WARNING: Search Grounding is ENABLED. This is the most expensive API feature ($14/1000 requests). Use it only for tests and remove ENABLE_SEARCH_GROUNDING from .env.local afterwards.",
  );
}
const maxWebPageCharacters = 3000;
const webPageTimeoutMs = 5000;
const imageTimeoutMs = 30000;
const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const systemPrompt = `# Agent AI - nadrzędny operator narzędzi

Jesteś głównym agentem aplikacji. Użytkownik nie wybiera ręcznie narzędzia, tylko zleca Ci cel lub zadanie. Sam decydujesz, czy potrzebujesz rozmowy, obliczeń, pogody, aktualnej daty, wyszukiwarki Google, czytania strony, generowania obrazu albo analizy obrazu przekazanego w wiadomości.

Baza wiedzy firmy:
- Masz dostęp do bazy wiedzy firmy przez narzędzie searchKnowledge.
- Gdy użytkownik pyta o ceny, pakiety, koszty, oferty, regulamin, procedury, warunki, FAQ albo usługi firmy, ZAWSZE użyj searchKnowledge najpierw.
- NIE używaj searchKnowledge do pogody, kursów walut, aktualności, wiedzy ogólnej ani faktów spoza dokumentów firmowych.
- Odpowiadaj TYLKO na podstawie znalezionych fragmentów. Nie wymyślaj cen, warunków ani szczegółów oferty.
- Jeśli searchKnowledge zwróci 0 wyników albo najlepszy wynik ma similarity poniżej 0.5, NIE odpowiadaj z wiedzy ogólnej. Powiedz dokładnie: "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio."
- Priorytet narzędzi: pogoda -> getWeather; pytania firmowe/cennik/FAQ -> searchKnowledge; pytania ogólne/aktualne -> Google Search lub czytanie stron; obliczenia -> calculator.

Cytowanie źródeł z bazy wiedzy:
- Gdy odpowiadasz na podstawie searchKnowledge, ZAWSZE dodaj na końcu odpowiedzi osobną linię "📎 Źródło: [tytuł dokumentu]".
- Jeśli odpowiedź łączy dane z wielu dokumentów, użyj formatu "📎 Źródła: [tytuł 1], [tytuł 2]".
- Cytuj tytuły z pola source_documents albo title wyniku narzędzia.
- Nie dodawaj cytowania źródeł RAG przy pogodzie, kursach walut, obliczeniach ani odpowiedziach ogólnych spoza bazy wiedzy.

Zasady nadrzędne:
- Odpowiadasz po polsku, konkretnie i praktycznie.
- Jeżeli zadanie wymaga aktualnych danych, używasz wyszukiwarki lub czytania stron zamiast zgadywać.
- Jeżeli zadanie wymaga liczb, używasz kalkulatora i pokazujesz wynik jasno.
- Jeżeli zadanie pasuje do funkcji City Break Planner, możesz przygotować plan w rozmowie, a przy pełnym generatorze wskaż, że dedykowana funkcja jest dostępna w zakładce City Break Planner.
- Jeżeli zadanie wymaga autonomicznego wykonania kroków, rozpisujesz plan, dobierasz narzędzia i składasz odpowiedź z obserwacji.
- Nie odmawiasz tylko dlatego, że temat nie jest biznesowy. Poza poradami prawnymi, medycznymi i finansowymi wysokiego ryzyka pomagaj najlepiej jak potrafisz, oznaczając niepewność.

# Leo - dodatkowa specjalizacja biznesowa

## KIM JESTEM
Jestem strategicznym doradcą biznesu cyfrowego z ponad 15-letnim doświadczeniem w e-commerce, transformacji cyfrowej i automatyzacji procesów biznesowych.
Specjalizuję się w projektowaniu procesów sprzedaży online, integracjach systemów oraz wykorzystaniu AI i automatyzacji do mierzalnej poprawy wyników firmy.
Pracowałem z firmami B2B i B2C, sklepami internetowymi, zespołami sprzedaży, zarządami oraz organizacjami wdrażającymi ERP, CRM, PIM, WMS, marketplace i narzędzia marketing automation.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** - potwierdzam zrozumienie pytania w 1 zdaniu.
2. 🔍 **Analiza** - daję merytoryczną odpowiedź w maksymalnie 2 akapitach.
3. ✅ **Rekomendacja** - wskazuję konkretne działanie w 1-3 punktach.
4. ❓ **Pytanie** - zadaję jedno pytanie pogłębiające do użytkownika.

### Zasady:
- ZANIM odpowiem na złożone pytanie, proszę o brakujący kontekst, jeśli bez niego rekomendacja byłaby zgadywaniem.
- Gdy podaję fakty, oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji.
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu.
- Używam list numerowanych dla kroków i list punktowanych dla opcji.
- Maksymalnie 3 akapity oraz sekcja rekomendacji, chyba że użytkownik prosi o szczegółową analizę, kalkulację lub plan wdrożenia.
- Pamiętam przebieg rozmowy, bo otrzymuję historię wiadomości w każdym zapytaniu. Nawiązuję do wcześniejszego kontekstu, gdy pomaga to w odpowiedzi.

### Styl:
- Język: polski.
- Ton: profesjonalny, konkretny i przystępny.
- Gdy używam terminu branżowego, wyjaśniam go w nawiasie.
- Myślę jak konsultant zarządu: zaczynam od celu biznesowego, procesu, danych i kosztu, a dopiero potem rekomenduję narzędzia.
- Unikam sloganów, ogólników i rekomendowania AI bez uzasadnienia biznesowego.

## OBSZAR EKSPERTYZY
Odpowiadam w obszarach: strategia biznesowa, transformacja cyfrowa, e-commerce, polityka cenowa, sprzedaż B2B i B2C, automatyzacja procesów, integracja systemów, AI agents, AI workflows, obsługa klienta, analityka biznesowa, zarządzanie procesami oraz managerial accounting.

Uwzględniam narzędzia i systemy takie jak Shopify, Shoper, BaseLinker, ERP, CRM, PIM, CMS, DAM, WMS, systemy księgowe, systemy kurierskie i płatności, marketplace, Google Merchant Center, GA4, Google Ads, Meta Ads, LinkedIn, BI, API, webhooki, n8n, Make, Zapier, Power Automate i MCP.

W analizach integracji pokazuję przepływ danych: źródło danych, system docelowy, sposób wymiany, częstotliwość synchronizacji, właściciela danych, możliwe błędy i monitoring procesu.

W polityce cenowej i rachunkowości zarządczej analizuję marżę, próg rentowności, contribution margin (marżę kontrybucyjną), koszty stałe i zmienne, margin of safety (margines bezpieczeństwa), operating leverage (dźwignię operacyjną) oraz wpływ zmian cen na rentowność produktu, kategorii i firmy.

## CZEGO NIE ROBIĘ
- Nie udaję eksperta w dziedzinach wysokiego ryzyka. Gdy temat wymaga specjalisty, porządkuję kontekst i jasno zaznaczam ograniczenia.
- Nie udaję, że wiem coś, czego nie wiem.
- Nie udzielam porad prawnych, medycznych ani finansowych jako wiążącej ekspertyzy. Mogę pomóc przygotować pytania do specjalisty lub uporządkować kontekst biznesowy.
- Nie automatyzuję procesu tylko dlatego, że jest to technicznie możliwe. Jeśli prostsze rozwiązanie daje podobny efekt jak AI, rekomenduję prostszy wariant.`;

function getModel(model: unknown): AiModel {
  return model === "pro" ? "pro" : "flash";
}

function decodeHtmlEntities(text: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalizedEntity = entity.toLowerCase();

    if (normalizedEntity in namedEntities) {
      return namedEntities[normalizedEntity];
    }

    if (normalizedEntity.startsWith("#x")) {
      const codePoint = Number.parseInt(normalizedEntity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalizedEntity.startsWith("#")) {
      const codePoint = Number.parseInt(normalizedEntity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return match;
  });
}

function extractTextFromHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, maxWebPageCharacters);
}

function weatherDescription(code: number) {
  const descriptions: Record<number, string> = {
    0: "bezchmurnie",
    1: "glownie bezchmurnie",
    2: "czesciowe zachmurzenie",
    3: "pochmurno",
    45: "mgla",
    48: "mgla osadzajaca szadz",
    51: "lekka mzawka",
    53: "umiarkowana mzawka",
    55: "gesta mzawka",
    61: "lekki deszcz",
    63: "umiarkowany deszcz",
    65: "silny deszcz",
    71: "lekki snieg",
    73: "umiarkowany snieg",
    75: "silny snieg",
    80: "lekkie przelotne opady",
    81: "umiarkowane przelotne opady",
    82: "gwaltowne przelotne opady",
    95: "burza",
    96: "burza z gradem",
    99: "silna burza z gradem",
  };

  return descriptions[code] ?? `kod pogody ${code}`;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "lekcja-06-agent/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function isQuotaError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("429")
  );
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Operacja przekroczyla limit czasu.")),
        milliseconds,
      );
    }),
  ]);
}

function evaluateMathExpression(expression: string) {
  const cleanExpression = expression.trim().replace(/,/g, ".");

  if (!/^[\d+\-*/().\s%]+$/.test(cleanExpression)) {
    throw new Error("Kalkulator obsluguje tylko liczby i operatory + - * / % ().");
  }

  const result = Function(`"use strict"; return (${cleanExpression});`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Wynik dzialania nie jest poprawna liczba.");
  }

  return result;
}

async function generateImageWithGemini(prompt: string) {
  const apiKey =
    process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return {
      error:
        "Brakuje zmiennej srodowiskowej GOOGLE_API_KEY albo GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (const imageModel of imageModels) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: imageModel,
          contents: prompt,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        imageTimeoutMs,
      );
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((part) => part.inlineData?.data);
      const textPart = parts.find((part) => part.text);

      if (!imagePart?.inlineData?.data) {
        return {
          error: "Model nie zwrocil obrazu. Sprobuj doprecyzowac opis.",
        };
      }

      const mimeType = imagePart.inlineData.mimeType || "image/png";

      return {
        image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
        model: imageModel,
        prompt,
        text: textPart?.text ?? "",
      };
    } catch (modelError) {
      lastError = modelError;

      if (!isQuotaError(modelError)) {
        break;
      }
    }
  }

  return {
    error: isQuotaError(lastError)
      ? "Google blokuje generowanie obrazow dla tego projektu API albo modelu. Limity sa liczone per projekt Google Cloud/AI Studio i konkretny model."
      : getErrorText(lastError),
  };
}

function createBaseTools(supabase: SupabaseClient, userId: string) {
  return {
  searchKnowledge: tool({
    description:
      "Wyszukuje informacje w bazie wiedzy firmy: cenniki, FAQ, regulaminy, procedury, warunki, oferty i dokumenty uslug. Uzywaj ZAWSZE gdy uzytkownik pyta o ceny, pakiety, koszty, oferte, regulamin, FAQ albo informacje firmowe. Nie uzywaj do pogody, kursow walut ani wiedzy ogolnej.",
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .describe("Pytanie lub fraza do wyszukania w bazie wiedzy firmy."),
    }),
    execute: async ({ query }) => {
      try {
        return await searchKnowledgeBase(supabase, userId, query);
      } catch (error) {
        return {
          error: getErrorText(error),
          query,
          results: [],
          total_found: 0,
        };
      }
    },
  }),

  getWeather: tool({
    description:
      "Pobiera aktualna pogode dla podanego miasta. Uzywaj ZAWSZE, gdy uzytkownik pyta o pogode, temperature, wiatr, opady lub warunki atmosferyczne.",
    inputSchema: z.object({
      city: z.string().describe("Miasto, np. Warszawa"),
    }),
    execute: async ({ city }) => {
      try {
        type GeoResponse = {
          results?: Array<{
            country: string;
            latitude: number;
            longitude: number;
            name: string;
          }>;
        };

        type WeatherResponse = {
          current: {
            precipitation: number;
            temperature_2m: number;
            weather_code: number;
            wind_speed_10m: number;
          };
          current_units: Record<string, string>;
        };

        const geo = await fetchJson<GeoResponse>(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city,
          )}&count=1&language=pl&format=json`,
        );
        const location = geo.results?.[0];

        if (!location) {
          return {
            city,
            error: "Nie znaleziono miasta.",
            source: "Open-Meteo Geocoding API",
          };
        }

        const weather = await fetchJson<WeatherResponse>(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`,
        );

        return {
          city: location.name,
          country: location.country,
          description: weatherDescription(weather.current.weather_code),
          precipitation: weather.current.precipitation,
          precipitationUnit: weather.current_units.precipitation,
          source: "Open-Meteo API",
          temperature: weather.current.temperature_2m,
          temperatureUnit: weather.current_units.temperature_2m,
          windSpeed: weather.current.wind_speed_10m,
          windSpeedUnit: weather.current_units.wind_speed_10m,
        };
      } catch (error) {
        return {
          city,
          error: getErrorText(error),
          source: "Open-Meteo API",
        };
      }
    },
  }),

  calculator: tool({
    description:
      "Wykonuje proste obliczenia matematyczne, np. VAT, marza, procenty, netto/brutto. Uzywaj wyrazen typu 8500 * 0.23.",
    inputSchema: z.object({
      expression: z
        .string()
        .describe("Wyrazenie matematyczne z liczbami i operatorami + - * / % ()."),
    }),
    execute: async ({ expression }) => {
      try {
        const result = evaluateMathExpression(expression);

        return {
          expression,
          result,
        };
      } catch (error) {
        return {
          error: getErrorText(error),
          expression,
        };
      }
    },
  }),
  currentDateTime: tool({
    description:
      "Zwraca aktualna date i czas. Uzywaj gdy zadanie zalezy od dzisiejszej daty, dnia tygodnia albo strefy czasowej.",
    inputSchema: z.object({
      timeZone: z
        .string()
        .default("Europe/Warsaw")
        .describe("Strefa czasowa IANA, domyslnie Europe/Warsaw."),
    }),
    execute: async ({ timeZone }) => {
      const now = new Date();

      return {
        iso: now.toISOString(),
        timeZone,
        formatted: new Intl.DateTimeFormat("pl-PL", {
          dateStyle: "full",
          timeStyle: "medium",
          timeZone,
        }).format(now),
      };
    },
  }),
  ...(isSearchGroundingEnabled
    ? { google_search: google.tools.googleSearch({}) }
    : {}),
  readWebPage: tool({
    description:
      "Pobiera i czyta zawartosc strony internetowej. Uzywaj gdy uzytkownik poda URL lub gdy chcesz przeczytac artykul/strone znaleziona w wyszukiwarce.",
    inputSchema: z.object({
      url: z.string().url().describe("Pelny adres URL strony internetowej."),
    }),
    execute: async ({ url }) => {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(url);
      } catch {
        return `Nie moge przeczytac strony: "${url}" nie jest poprawnym adresem URL.`;
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "Nie moge przeczytac strony: obslugiwane sa tylko adresy http i https.";
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webPageTimeoutMs);

      try {
        const response = await fetch(parsedUrl.toString(), {
          cache: "no-store",
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; LeoAgent/1.0)",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          return `Nie moge przeczytac strony: serwer zwrocil blad HTTP ${response.status}.`;
        }

        const html = await response.text();
        const text = extractTextFromHtml(html);

        if (!text) {
          return "Strona zostala pobrana, ale nie udalo sie wyciagnac czytelnego tekstu.";
        }

        return text;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return "Nie moge przeczytac strony: przekroczono limit 5 sekund.";
        }

        return `Nie moge przeczytac strony: ${getErrorText(error)}.`;
      } finally {
        clearTimeout(timeout);
      }
    },
  }),
  generateImage: tool({
    description:
      "Generuje obraz na podstawie opisu. Uzywaj gdy uzytkownik prosi o logo, grafike, ilustracje, kreacje reklamowa albo post wizualny.",
    inputSchema: z.object({
      prompt: z.string().describe("Szczegolowy opis obrazu do wygenerowania."),
    }),
    execute: async ({ prompt }) => generateImageWithGemini(prompt),
  }),
  };
}

function createAgentTools(
  supabase: SupabaseClient,
  userId: unknown,
) {
  const profileId = isValidUserId(userId) ? userId : null;

  return {
    ...createBaseTools(supabase, profileId ?? ""),
    saveUserName: tool({
      description:
        "Zapisuje imię użytkownika w jego trwałym profilu. Użyj obowiązkowo po otrzymaniu imienia użytkownika.",
      inputSchema: z.object({
        name: z.string().min(1).max(79).describe("Imię użytkownika."),
      }),
      execute: async ({ name }) => saveUserName(supabase, profileId, name),
    }),
    saveUserPreference: tool({
      description:
        "Zapisuje trwałą preferencję użytkownika, np. branżę, miasto, ulubione jedzenie lub zainteresowanie. Używaj tylko dla wyraźnie podanych, stałych informacji o użytkowniku.",
      inputSchema: z.object({
        key: z.string().min(1).max(48).describe("Krótki klucz, np. branza lub miasto."),
        value: z.string().min(1).max(160).describe("Wartość preferencji."),
      }),
      execute: async ({ key, value }) =>
        saveUserPreference(supabase, profileId, key, value),
    }),
    saveUserDetails: tool({
      description:
        "Zapisuje w trwałej pamięci firmę i stanowisko użytkownika. Użyj, gdy użytkownik poda firmę, pracodawcę, rolę zawodową albo stanowisko.",
      inputSchema: z.object({
        company: z.string().min(1).max(160).optional().describe("Firma lub pracodawca."),
        jobTitle: z.string().min(1).max(160).optional().describe("Stanowisko lub rola zawodowa."),
      }),
      execute: async ({ company, jobTitle }) =>
        saveUserDetails(supabase, profileId, { company, jobTitle }),
    }),
  };
}

type AgentTools = ReturnType<typeof createAgentTools>;

function extractNameFromMessage(message: string) {
  const explicitName = message.match(
    /\b(?:mam na imi(?:ę|e)|nazywam si(?:ę|e))\s+([\p{L}][\p{L}\s'-]{0,78})/iu,
  );

  if (explicitName?.[1]) {
    return explicitName[1].replace(/[.!?,;:]+$/u, "").trim();
  }

  const standaloneName = message.match(
    /^\s*([\p{L}][\p{L}'-]{1,78})(?:[.!]?\s*)$/u,
  );
  const nameBeforeQuestion = message.match(
    /^\s*([\p{L}][\p{L}'-]{1,78})\.\s*(?=(?:powiedz|kim|jak|jakie)\b)/iu,
  );

  return standaloneName?.[1] ?? nameBeforeQuestion?.[1] ?? null;
}

function extractPreferencesFromMessage(message: string) {
  const preferences: Array<{ key: string; value: string }> = [];
  const industry = message.match(
    /\b(?:dzia(?:\u0142|l)am w bran(?:\u017c|z)y|moja bran(?:\u017c|z)a to|bran(?:\u017c|z)a to)\s+([^.,;!?\n]+)/iu,
  )?.[1]?.trim();
  const city = message.match(/\bmieszkam w\s+([^.,;!?\n]+)/iu)?.[1]?.trim();
  const likes = message.match(/\blubi(?:ę|e)\s+([^.,;!?\n]+)/iu)?.[1]?.trim();

  if (city) {
    preferences.push({ key: "miasto", value: city });
  }

  if (likes) {
    preferences.push({ key: "zainteresowania", value: likes });
  }

  if (industry) {
    preferences.push({ key: "branza", value: industry });
  }

  return preferences;
}

function extractUserDetails(message: string) {
  const company = message.match(
    /\b(?:pracuj(?:\u0119|e)\s+w\s+firmie|pracuj(?:\u0119|e)\s+w|w firmie|moja firma to)\s+([^.,;!?\n]+?)(?:\s+jako\s+|[.,;!?\n]|$)/iu,
  )?.[1]?.trim();
  const jobTitle = message.match(
    /\b(?:pracuj(?:\u0119|e)\s+jako|jako|moje stanowisko to|stanowisko:)\s+([^.,;!?\n]+)/iu,
  )?.[1]?.trim();

  return { company, jobTitle };
}

function isProfileQuestion(message: string) {
  return /\b(kim jestem|jak mam na imi(?:ę|e)|czy mnie pami(?:ę|e)tasz|jaka jest moja firma|gdzie pracuj(?:ę|e)|jakie mam stanowisko|jakie mam preferencje|co o mnie wiesz)\b/iu.test(
    message,
  );
}

type RememberedFacts = {
  name?: string;
  company?: string;
  jobTitle?: string;
  city?: string;
  interests?: string;
};

function getFactsFromConversationMemory(memory: ConversationMemoryMessage[]) {
  const recentMessages = [...memory].reverse();
  const userMessages = recentMessages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
  const allMessages = recentMessages.map((message) => message.content).join("\n");

  const latestMatch = (text: string, pattern: RegExp) => {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const matches = [...text.matchAll(new RegExp(pattern.source, flags))];
    return matches.at(-1)?.[1]?.trim();
  };

  const read = (pattern: RegExp, fallbackPattern?: RegExp) =>
    latestMatch(userMessages, pattern) ??
    (fallbackPattern ? latestMatch(allMessages, fallbackPattern) : undefined);

  return {
    name: read(
      /\b(?:mam na imi(?:ę|e)|nazywam si(?:ę|e))\s+([\p{L}][\p{L}\s'-]{0,78})/iu,
      /\b(?:u(?:ż|z)ytkownik ma na imi(?:ę|e)|cześć[,! ]+)\s*([\p{L}][\p{L}'-]{1,78})/iu,
    ),
    company: read(
      /\b(?:pracuj(?:ę|e) w|w firmie)\s+([^.,;!?\n]+?)(?:\s+jako\s+|[.,;!?\n]|$)/iu,
      /\bfirma(?: u(?:ż|z)ytkownika)?(?: to|:)?\s+([^.,;!?\n]+)/iu,
    ),
    jobTitle: read(
      /\b(?:jako|stanowisko(?: to)?)\s+([^.,;!?\n]+?)(?:\s+w firmie\s+|[.,;!?\n]|$)/iu,
      /\b(?:stanowisko|rola)(?: u(?:ż|z)ytkownika)?(?: to|:)?\s+([^.,;!?\n]+)/iu,
    ),
    city: read(/\bmieszkam w\s+([^.,;!?\n]+)/iu),
    interests: read(/\blubi(?:ę|e)\s+([^.,;!?\n]+)/iu),
  } satisfies RememberedFacts;
}

function createProfileAnswer(
  profile: StoredUserProfile | null,
  rememberedFacts: RememberedFacts,
) {
  const name = profile?.name ?? rememberedFacts.name;

  if (!name) {
    return "Cześć! Nie znamy się jeszcze. Jak masz na imię?";
  }

  const facts = [`masz na imię ${name}`];
  const company = profile?.preferences.firma ?? rememberedFacts.company;
  const jobTitle = profile?.preferences.stanowisko ?? rememberedFacts.jobTitle;

  if (company) {
    facts.push(`pracujesz w firmie ${company}`);
  }

  if (jobTitle) {
    facts.push(`Twoje stanowisko to ${jobTitle}`);
  }

  const otherPreferences = Object.entries(profile?.preferences ?? {}).filter(
    ([key]) => key !== "firma" && key !== "stanowisko",
  );

  if (otherPreferences.length > 0) {
    facts.push(
      ...otherPreferences.map(([key, value]) => `${key}: ${value}`),
    );
  }

  if (!profile?.preferences.miasto && rememberedFacts.city) {
    facts.push(`miasto: ${rememberedFacts.city}`);
  }

  if (!profile?.preferences.zainteresowania && rememberedFacts.interests) {
    facts.push(`zainteresowania: ${rememberedFacts.interests}`);
  }

  if (facts.length === 1) {
    facts.push("nie mam jeszcze zapisanych preferencji");
  }

  return `Pamiętam Cię, ${name}. Zapisane informacje: ${facts.join(", ")}.`;
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Nieznany blad");
}

function getStatusCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = Number(error.statusCode);

    if (Number.isFinite(statusCode)) {
      return statusCode;
    }
  }

  return null;
}

function shouldFallbackToFlash25(error: unknown) {
  const actualError = getUnderlyingError(error);
  const message = getErrorText(actualError).toLowerCase();
  const statusCode = getStatusCode(actualError);

  return (
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 503 ||
    message.includes("quota exceeded") ||
    message.includes("exceeded your current quota") ||
    message.includes("rate-limits") ||
    message.includes("rate limit") ||
    message.includes("unavailable") ||
    message.includes("overloaded")
  );
}

function getUnderlyingError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    "didSendToClient" in error
  ) {
    return error.error;
  }

  return error;
}

function didSendToClient(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "didSendToClient" in error &&
      error.didSendToClient,
  );
}

function getApiErrorMessage(error: unknown) {
  const actualError = getUnderlyingError(error);
  const message = getErrorText(actualError);
  if (
    message.includes("Quota exceeded") ||
    message.includes("exceeded your current quota") ||
    message.includes("rate-limits")
  ) {
    const retryMatch = message.match(/retry in ([0-9.]+)s/i);
    const seconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : null;
    const waitText = seconds
      ? `Odczekaj okolo ${seconds} s i sproboj ponownie.`
      : "Odczekaj chwile i sproboj ponownie.";

    return `Limit darmowych zapytan dla wybranego modelu zostal chwilowo wykorzystany. ${waitText} Mozesz tez przelaczyc model i sprobowac jeszcze raz.`;
  }

  return actualError instanceof Error
    ? actualError.message
    : "Nieznany blad po stronie API.";
}

function getMessageText(parts: { type: string; text?: string }[]) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function getLastUserText(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      return getMessageText(messages[i].parts);
    }
  }

  return "";
}

function parseImageDataUrl(image: unknown) {
  if (typeof image !== "string") {
    return null;
  }

  const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i);

  if (!match) {
    return null;
  }

  const mediaType = match[1].toLowerCase();

  if (!allowedImageTypes.has(mediaType)) {
    return null;
  }

  return {
    data: match[2],
    mediaType,
  };
}

function addImageToLastUserMessage(
  modelMessages: ModelMessage[],
  image: unknown,
  fallbackText: string,
): ModelMessage[] {
  const imageData = parseImageDataUrl(image);

  if (!imageData) {
    return modelMessages;
  }

  const nextMessages = [...modelMessages];

  for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
    const message = nextMessages[i];

    if (message.role !== "user") {
      continue;
    }

    const content: UserContent = Array.isArray(message.content)
      ? [
          ...message.content,
          {
            type: "file",
            mediaType: imageData.mediaType,
            data: { type: "data", data: imageData.data },
          },
        ]
      : [
          { type: "text", text: message.content || fallbackText || "Opisz ten obraz." },
          {
            type: "file",
            mediaType: imageData.mediaType,
            data: { type: "data", data: imageData.data },
          },
        ];

    nextMessages[i] = {
      ...message,
      content,
    };

    return nextMessages;
  }

  return [
    ...nextMessages,
    {
      role: "user" as const,
      content: [
        { type: "text", text: fallbackText || "Opisz ten obraz." },
        {
          type: "file",
          mediaType: imageData.mediaType,
          data: { type: "data", data: imageData.data },
        },
      ],
    },
  ];
}

function getOfflineResponse(userText: string) {
  const normalizedText = userText.toLowerCase();

  if (normalizedText.includes("prompt")) {
    return `📋 **Kontekst** - Pytasz, czym jest **prompt** w pracy z AI.

🔍 **Analiza** - ✓ **Prompt** to instrukcja, pytanie albo zestaw wskazówek, które przekazujesz modelowi AI, żeby otrzymać konkretną odpowiedź. Można go porównać do briefu dla specjalisty: im jaśniej opiszesz cel, kontekst, format i ograniczenia, tym większa szansa na użyteczny wynik.

W praktyce prompt może brzmieć krótko, np. "Wyjaśnij API prostym językiem", albo profesjonalnie: "Jesteś ekspertem e-commerce. Przygotuj tabelę z 5 sposobami automatyzacji obsługi zamówień, podaj koszt, trudność i ryzyko".

✅ **Rekomendacja**
- Podawaj modelowi rolę, cel, kontekst i oczekiwany format odpowiedzi.
- Przy ważnych zadaniach dodawaj przykłady dobrej odpowiedzi.
- Testuj kilka wersji promptu i porównuj wyniki.

❓ **Pytanie** - Chcesz, żebym przygotował Ci szablon dobrego promptu do Twojego agenta biznesowego?`;
  }

  return `📋 **Kontekst** - Chcesz uzyskać odpowiedź, ale limit darmowych zapytań Google Gemini został chwilowo wyczerpany.

🔍 **Analiza** - Aplikacja próbowała użyć kilku modeli awaryjnych, ale Google zwrócił limit także dla nich. To ograniczenie po stronie klucza API, nie błąd interfejsu ani kodu aplikacji.

✅ **Rekomendacja**
- Odczekaj około minutę i spróbuj ponownie.
- Jeśli problem wraca często, sprawdź limity w Google AI Studio.
- Do testów prostych definicji możesz użyć strony "📚 Słownik", gdy limit znów będzie dostępny.

❓ **Pytanie** - Możesz odświeżyć lub ponowić zadanie za chwilę. Pasek trybu awaryjnego pokazuje licznik zdarzeń oraz model podstawowy i fallback.`;
}

function enqueueTextResponse(
  controller: ReadableStreamDefaultController<UIMessageChunk>,
  text: string,
) {
  const id = `offline-${Date.now()}`;

  controller.enqueue({ type: "start" });
  controller.enqueue({ type: "start-step" });
  controller.enqueue({ type: "text-start", id });
  controller.enqueue({ type: "text-delta", id, delta: text });
  controller.enqueue({ type: "text-end", id });
  controller.enqueue({ type: "finish-step" });
  controller.enqueue({ type: "finish", finishReason: "stop" });
}

function formatTokenCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pl-PL")
    : "brak danych";
}

function createUsageFooter(modelId: string, usage?: LanguageModelUsage) {
  return [
    "",
    "",
    "---",
    `Model AI: ${modelId}`,
    `Tokeny: wejście ${formatTokenCount(usage?.inputTokens)}, wyjście ${formatTokenCount(
      usage?.outputTokens,
    )}, razem ${formatTokenCount(usage?.totalTokens)}`,
  ].join("\n");
}

function enqueueUsageFooter(
  controller: ReadableStreamDefaultController<UIMessageChunk>,
  modelId: string,
  usage?: LanguageModelUsage,
) {
  const id = `usage-${Date.now()}`;

  controller.enqueue({ type: "text-start", id });
  controller.enqueue({
    type: "text-delta",
    id,
    delta: createUsageFooter(modelId, usage),
  });
  controller.enqueue({ type: "text-end", id });
}

async function streamModelToController({
  controller,
  modelMessages,
  agentTools,
  personalizedSystemPrompt,
  bufferUntilContent = false,
}: {
  controller: ReadableStreamDefaultController<UIMessageChunk>;
  modelMessages: ModelMessage[];
  agentTools: AgentTools;
  personalizedSystemPrompt: string;
  bufferUntilContent?: boolean;
}) {
  const result = streamText({
    model: google(chatModelId),
    system: personalizedSystemPrompt,
    messages: modelMessages,
    tools: agentTools,
    stopWhen: stepCountIs(maxSteps),
  });
  const bufferedChunks: UIMessageChunk[] = [];
  let didFlushToClient = !bufferUntilContent;
  let finishChunk: UIMessageChunk | null = null;
  let pendingFinishStepChunk: UIMessageChunk | null = null;

  function enqueueChunk(chunk: UIMessageChunk) {
    if (pendingFinishStepChunk && chunk.type !== "finish") {
      const finishStepChunk = pendingFinishStepChunk;
      pendingFinishStepChunk = null;
      enqueueChunk(finishStepChunk);
    }

    if (didFlushToClient) {
      controller.enqueue(chunk);
      return;
    }

    bufferedChunks.push(chunk);
  }

  function flushBufferedChunks() {
    if (didFlushToClient) {
      return;
    }

    for (const chunk of bufferedChunks) {
      controller.enqueue(chunk);
    }

    bufferedChunks.length = 0;
    didFlushToClient = true;
  }

  try {
    for await (const part of result.stream) {
      if (part.type === "error") {
        throw part.error;
      }

      const shouldFlushBeforeChunk =
        part.type === "text-delta" || part.type === "reasoning-delta";
      const chunk = toUIMessageChunk(part, {
        onError: getApiErrorMessage,
      });

      if (shouldFlushBeforeChunk) {
        flushBufferedChunks();
      }

      if (chunk) {
        if (chunk.type === "finish") {
          finishChunk = chunk;
          continue;
        }

        if (chunk.type === "finish-step") {
          pendingFinishStepChunk = chunk;
          continue;
        }

        enqueueChunk(chunk);
      }
    }

    flushBufferedChunks();
    enqueueUsageFooter(controller, chatModelId, await result.usage);

    if (pendingFinishStepChunk) {
      controller.enqueue(pendingFinishStepChunk);
    }

    if (finishChunk) {
      controller.enqueue(finishChunk);
    }
  } catch (error) {
    throw {
      error,
      didSendToClient: didFlushToClient,
    };
  }
}

function createFallbackStream({
  selectedModel,
  modelMessages,
  lastUserText,
  agentTools,
  personalizedSystemPrompt,
}: {
  selectedModel: AiModel;
  modelMessages: ModelMessage[];
  lastUserText: string;
  agentTools: AgentTools;
  personalizedSystemPrompt: string;
}) {
  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      try {
        await streamModelToController({
          controller,
          modelMessages,
          agentTools,
          personalizedSystemPrompt,
          bufferUntilContent: selectedModel === "flash",
        });
        controller.close();
      } catch (error) {
        if (selectedModel === "flash" && !didSendToClient(error)) {
          if (shouldFallbackToFlash25(error)) {
            enqueueTextResponse(
              controller,
              `${getOfflineResponse(lastUserText)}${createUsageFooter(
                "odpowiedź awaryjna bez wywołania modelu",
              )}`,
            );
            controller.close();
            return;
          }
        }

        controller.enqueue({
          type: "error",
          errorText: getApiErrorMessage(error),
        });
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser(req).catch(() => null);

  if (!auth) {
    return Response.json(
      { error: "Wymagane jest zalogowanie." },
      { status: 401 },
    );
  }

  const { supabase, user } = auth;
  const {
    image,
    messages,
    model,
  }: { image?: unknown; messages: UIMessage[]; model?: unknown } =
    await req.json();
  const selectedModel = getModel(model);
  const lastUserText = getLastUserText(messages);
  const modelMessages = addImageToLastUserMessage(
    await convertToModelMessages(messages),
    image,
    lastUserText,
  );
  const userId = user.id;
  const { profile: loadedProfile, error: profileError } =
    await getOrCreateUserProfile(supabase, userId);
  const detectedName = extractNameFromMessage(lastUserText);
  const detectedPreferences = extractPreferencesFromMessage(lastUserText);
  const detectedDetails = extractUserDetails(lastUserText);
  let profile = loadedProfile;

  if (detectedName && isValidUserId(userId)) {
    const savedName = await saveUserName(supabase, userId, detectedName);

    if (savedName.saved && profile) {
      profile = { ...profile, name: savedName.name ?? profile.name };
    }
  }

  if (isValidUserId(userId) && detectedPreferences.length > 0) {
    for (const preference of detectedPreferences) {
      const savedPreference = await saveUserPreference(
        supabase,
        userId,
        preference.key,
        preference.value,
      );

      if (savedPreference.saved && profile) {
        profile = {
          ...profile,
          preferences: {
            ...profile.preferences,
            [preference.key]: preference.value,
          },
        };
      }
    }
  }

  if (
    isValidUserId(userId) &&
    (detectedDetails.company || detectedDetails.jobTitle)
  ) {
    const savedDetails = await saveUserDetails(
      supabase,
      userId,
      detectedDetails,
    );

    if (savedDetails.saved && profile) {
      profile = {
        ...profile,
        preferences: {
          ...profile.preferences,
          ...(detectedDetails.company ? { firma: detectedDetails.company } : {}),
          ...(detectedDetails.jobTitle ? { stanowisko: detectedDetails.jobTitle } : {}),
        },
      };
    }
  }

  const recentConversationMemory = await getRecentConversationMemory(
    supabase,
    userId,
  );
  const rememberedFacts = getFactsFromConversationMemory(recentConversationMemory);
  const conversationMemoryText = recentConversationMemory
    .map((message) => `${message.role === "user" ? "Użytkownik" : "Agent"}: ${message.content}`)
    .join("\n")
    .slice(-6000);
  const conversationMemoryPrompt = conversationMemoryText
    ? `\n\nPamięć z wcześniejszych rozmów zapisanych w Supabase:\n${conversationMemoryText}\nWykorzystuj te informacje jako kontekst użytkownika. Nie pytaj ponownie o dane, które są w tej pamięci.`
    : "";
  const personalizedSystemPrompt = `${systemPrompt}${getProfilePrompt(profile, profileError)}${conversationMemoryPrompt}`;
  const agentTools = createAgentTools(supabase, userId);

  if (isProfileQuestion(lastUserText)) {
    const stream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        enqueueTextResponse(
          controller,
          `${createProfileAnswer(profile, rememberedFacts)}${createUsageFooter(
            "odpowiedź lokalna bez wywołania modelu",
          )}`,
        );
        controller.close();
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  const stream = createFallbackStream({
    selectedModel,
    modelMessages,
    lastUserText,
    agentTools,
    personalizedSystemPrompt,
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
