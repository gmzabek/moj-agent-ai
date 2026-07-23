import { google } from "@ai-sdk/google";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { searchKnowledgeBase } from "../../../lib/searchKnowledge.server";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";
import {
  getOrCreateUserProfile,
  getProfilePrompt,
  isValidUserId,
  saveUserDetails,
  saveUserName,
  saveUserPreference,
} from "../../../lib/userProfile.server";

export const runtime = "nodejs";

type Note = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

const notes: Note[] = [];
// AI SDK 5 uses stopWhen as the supported equivalent of maxSteps: 3.
const maxSteps = 3;
const isSearchGroundingEnabled = process.env.ENABLE_SEARCH_GROUNDING === "true";

if (isSearchGroundingEnabled) {
  console.warn(
    "WARNING: Search Grounding is ENABLED. This is the most expensive API feature ($14/1000 requests). Use it only for tests and remove ENABLE_SEARCH_GROUNDING from .env.local afterwards.",
  );
}

const systemPrompt = `Jesteś autonomicznym agentem. Gdy dostajesz ZADANIE (nie pytanie),
MUSISZ je zrealizować krok po kroku.

Baza wiedzy firmy:
- Masz dostęp do bazy wiedzy firmy przez narzędzie searchKnowledge.
- Gdy użytkownik pyta o ceny, pakiety, koszty, oferty, regulamin, procedury, warunki, FAQ albo usługi firmy, ZAWSZE użyj searchKnowledge najpierw.
- NIE używaj searchKnowledge do pogody, kursów walut, aktualności, wiedzy ogólnej ani faktów spoza dokumentów firmowych.
- Odpowiadaj TYLKO na podstawie znalezionych fragmentów. Nie wymyślaj cen, warunków ani szczegółów oferty.
- Jeśli searchKnowledge zwróci 0 wyników albo najlepszy wynik ma similarity poniżej 0.5, NIE odpowiadaj z wiedzy ogólnej. Powiedz dokładnie: "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio."
- Priorytet narzędzi: pogoda -> getWeather; kursy walut -> getExchangeRate; święta -> getHolidays; pytania firmowe/cennik/FAQ -> searchKnowledge; pytania ogólne/aktualne -> Google Search lub inne narzędzia; obliczenia -> calculator.

Cytowanie źródeł z bazy wiedzy:
- Gdy odpowiadasz na podstawie searchKnowledge, ZAWSZE dodaj na końcu odpowiedzi osobną linię "📎 Źródło: [tytuł dokumentu]".
- Jeśli odpowiedź łączy dane z wielu dokumentów, użyj formatu "📎 Źródła: [tytuł 1], [tytuł 2]".
- Cytuj tytuły z pola source_documents albo title wyniku narzędzia.
- Nie dodawaj cytowania źródeł RAG przy pogodzie, kursach walut, obliczeniach ani odpowiedziach ogólnych spoza bazy wiedzy.

## TWÓJ PROCES:

Dla KAŻDEGO kroku wypisz:

### 🧠 Myślę...
Co muszę teraz zrobić? Jakie informacje mi brakuje?
Które narzędzie użyć?

Potem UŻYJ narzędzia. Gdy używasz narzędzia, dodaj krótką sekcję:

### ⚙️ Narzędzie
Nazwa narzędzia i argumenty, których używasz.

Po otrzymaniu wyniku:

### 👁️ Obserwuję...
Co dostałem? Czy to wystarczy do odpowiedzi?
Jeśli nie — jaki następny krok?

Powtarzaj aż będziesz mieć WSZYSTKO co potrzebne.

Na koniec:

### ✅ Wynik końcowy
Podaj pełną, konkretną odpowiedź opartą na zebranych danych.
Cytuj źródła (API, Wikipedia, Google).

## ZASADY:
- ZAWSZE pokazuj tok myślenia — użytkownik widzi cały proces
- NIE zgaduj — jeśli potrzebujesz danych, UŻYJ narzędzia
- Maksymalnie 5 głównych kroków
- Jeśli narzędzie zwróci błąd — spróbuj inaczej lub poinformuj
- ŁĄCZ dane z wielu narzędzi w spójną odpowiedź
- Odpowiadaj po polsku
- Używaj dokładnie nagłówków markdown z procesu, żeby interfejs mógł wyróżnić kroki`;

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
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
    82: "gwałtowne przelotne opady",
    95: "burza",
    96: "burza z gradem",
    99: "silna burza z gradem",
  };

  return descriptions[code] ?? `kod pogody ${code}`;
}

function calculate(expression: string) {
  if (!/^[\d\s+\-*/().,%]+$/.test(expression)) {
    throw new Error("Dozwolone sa tylko liczby i operatory matematyczne.");
  }

  const normalized = expression.replace(/,/g, ".").replace(/%/g, "/100");
  const result = Function(`"use strict"; return (${normalized});`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Nie udalo sie obliczyc wyrazenia.");
  }

  return result;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "lekcja-04-react-agent/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
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
          error: error instanceof Error ? error.message : "Nie udalo sie przeszukac bazy wiedzy.",
          query,
          results: [],
          total_found: 0,
        };
      }
    },
  }),

  calculator: tool({
    description: "Wykonuje obliczenia matematyczne.",
    inputSchema: z.object({
      expression: z.string().describe("Wyrazenie matematyczne, np. 5000 * 4.25"),
    }),
    execute: async ({ expression }) => {
      try {
        const result = calculate(expression);
        return {
          expression,
          result,
          source: "Wbudowany kalkulator",
        };
      } catch (error) {
        return {
          expression,
          error: error instanceof Error ? error.message : "Nieznany blad",
        };
      }
    },
  }),

  currentDateTime: tool({
    description: "Zwraca aktualna date i godzine.",
    inputSchema: z.object({
      timezone: z.string().default("Europe/Warsaw").describe("Strefa czasowa IANA"),
    }),
    execute: async ({ timezone }) => {
      const now = new Date();

      return {
        iso: now.toISOString(),
        timezone,
        local: new Intl.DateTimeFormat("pl-PL", {
          dateStyle: "full",
          timeStyle: "medium",
          timeZone: timezone,
        }).format(now),
        source: "System Date API",
      };
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
            name: string;
            country: string;
            latitude: number;
            longitude: number;
          }>;
        };

        type WeatherResponse = {
          current: {
            temperature_2m: number;
            wind_speed_10m: number;
            precipitation: number;
            weather_code: number;
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
          return { city, error: "Nie znaleziono miasta.", source: "Open-Meteo Geocoding API" };
        }

        const weather = await fetchJson<WeatherResponse>(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`,
        );

        return {
          city: location.name,
          country: location.country,
          temperature: weather.current.temperature_2m,
          temperatureUnit: weather.current_units.temperature_2m,
          windSpeed: weather.current.wind_speed_10m,
          windSpeedUnit: weather.current_units.wind_speed_10m,
          precipitation: weather.current.precipitation,
          precipitationUnit: weather.current_units.precipitation,
          description: weatherDescription(weather.current.weather_code),
          source: "Open-Meteo API",
        };
      } catch (error) {
        return {
          city,
          error: error instanceof Error ? error.message : "Nie udalo sie pobrac pogody.",
          source: "Open-Meteo API",
        };
      }
    },
  }),

  getExchangeRate: tool({
    description: "Pobiera kurs waluty wobec PLN z NBP.",
    inputSchema: z.object({
      currency: z.string().describe("Kod waluty ISO, np. EUR, USD, CHF"),
    }),
    execute: async ({ currency }) => {
      const code = currency.trim().toUpperCase();

      if (code === "PLN") {
        return {
          currency: "PLN",
          rateToPln: 1,
          source: "PLN jako waluta bazowa",
        };
      }

      try {
        type NbpResponse = {
          code: string;
          currency: string;
          rates: Array<{ effectiveDate: string; mid: number }>;
        };

        const data = await fetchJson<NbpResponse>(
          `https://api.nbp.pl/api/exchangerates/rates/A/${encodeURIComponent(code)}/?format=json`,
        );

        return {
          currency: data.code,
          name: data.currency,
          rateToPln: data.rates[0]?.mid,
          effectiveDate: data.rates[0]?.effectiveDate,
          source: "Narodowy Bank Polski API",
        };
      } catch (error) {
        return {
          currency: code,
          error: error instanceof Error ? error.message : "Nie udalo sie pobrac kursu.",
          source: "Narodowy Bank Polski API",
        };
      }
    },
  }),

  getHolidays: tool({
    description: "Pobiera swieta publiczne dla kraju i roku.",
    inputSchema: z.object({
      countryCode: z.string().default("PL").describe("Kod kraju ISO 3166-1 alpha-2, np. PL"),
      year: z.number().int().default(new Date().getFullYear()),
    }),
    execute: async ({ countryCode, year }) => {
      try {
        type Holiday = {
          date: string;
          localName: string;
          name: string;
          countryCode: string;
        };

        const data = await fetchJson<Holiday[]>(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`,
        );

        return {
          countryCode: countryCode.toUpperCase(),
          year,
          holidays: data,
          source: "Nager.Date Public Holidays API",
        };
      } catch (error) {
        return {
          countryCode,
          year,
          error: error instanceof Error ? error.message : "Nie udalo sie pobrac swiat.",
          source: "Nager.Date Public Holidays API",
        };
      }
    },
  }),

  searchWikipedia: tool({
    description: "Szuka hasel w Wikipedii.",
    inputSchema: z.object({
      query: z.string().describe("Fraza do wyszukania w Wikipedii"),
      language: z.string().default("pl").describe("Kod jezyka Wikipedii, np. pl lub en"),
    }),
    execute: async ({ query, language }) => {
      try {
        type WikiResponse = {
          pages?: Array<{
            title: string;
            description?: string;
            excerpt?: string;
            key: string;
          }>;
        };

        const data = await fetchJson<WikiResponse>(
          `https://${language}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
            query,
          )}&limit=5`,
        );

        return {
          query,
          language,
          results:
            data.pages?.map((page) => ({
              title: page.title,
              description: stripHtml(page.description ?? ""),
              excerpt: stripHtml(page.excerpt ?? ""),
              url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
            })) ?? [],
          source: "Wikipedia REST API",
        };
      } catch (error) {
        return {
          query,
          language,
          error: error instanceof Error ? error.message : "Nie udalo sie przeszukac Wikipedii.",
          source: "Wikipedia REST API",
        };
      }
    },
  }),

  readWebPage: tool({
    description:
      "Pobiera i czyta zawartosc strony internetowej. Uzywaj gdy uzytkownik poda URL lub gdy chcesz przeczytac artykul/strone znaleziona w wyszukiwarce.",
    inputSchema: z.object({
      url: z.string().url().describe("Pelny adres URL strony"),
    }),
    execute: async ({ url }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "lekcja-04-react-agent/1.0",
          },
        });

        if (!response.ok) {
          return {
            url,
            error: `Strona zwrocila HTTP ${response.status}.`,
            source: "Fetch API",
          };
        }

        const html = await response.text();
        const text = stripHtml(html).slice(0, 3000);

        return {
          url,
          text,
          length: text.length,
          source: "Fetch API",
        };
      } catch (error) {
        return {
          url,
          error:
            error instanceof Error && error.name === "AbortError"
              ? "Timeout po 5 sekundach."
              : error instanceof Error
                ? error.message
                : "Nie udalo sie przeczytac strony.",
          source: "Fetch API",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  }),

  saveNote: tool({
    description: "Zapisuje notatke w pamieci serwera.",
    inputSchema: z.object({
      title: z.string().describe("Tytul notatki"),
      content: z.string().describe("Tresc notatki"),
    }),
    execute: async ({ title, content }) => {
      const note = {
        id: notes.length + 1,
        title,
        content,
        createdAt: new Date().toISOString(),
      };

      notes.push(note);

      return {
        saved: true,
        note,
        source: "Pamiec procesu Next.js",
      };
    },
  }),

  getNotes: tool({
    description: "Zwraca zapisane notatki.",
    inputSchema: z.object({}),
    execute: async () => ({
      notes,
      count: notes.length,
      source: "Pamiec procesu Next.js",
    }),
  }),

  ...(isSearchGroundingEnabled
    ? { google_search: google.tools.googleSearch({}) }
    : {}),
  };
}

function createProfileTools(
  supabase: SupabaseClient,
  userId: unknown,
) {
  const profileId = isValidUserId(userId) ? userId : null;

  return {
    saveUserName: tool({
      description:
        "Zapisuje imię użytkownika w jego trwałym profilu. Użyj obowiązkowo, gdy użytkownik poda swoje imię.",
      inputSchema: z.object({
        name: z.string().min(1).max(79).describe("Imię podane przez użytkownika."),
      }),
      execute: async ({ name }) => saveUserName(supabase, profileId, name),
    }),
    saveUserPreference: tool({
      description:
        "Zapisuje trwałą preferencję użytkownika, np. miasto, ulubione jedzenie lub zainteresowanie. Używaj tylko dla wyraźnie podanych, stabilnych informacji o użytkowniku.",
      inputSchema: z.object({
        key: z
          .string()
          .min(1)
          .max(48)
          .describe("Krótki klucz po angielsku, np. miasto lub ulubione_jedzenie."),
        value: z.string().min(1).max(160).describe("Wartość preferencji użytkownika."),
      }),
      execute: async ({ key, value }) =>
        saveUserPreference(supabase, profileId, key, value),
    }),
    saveUserDetails: tool({
      description:
        "Zapisuje w trwałej pamięci firmę i stanowisko użytkownika. Użyj obowiązkowo, gdy użytkownik poda firmę, pracodawcę, rolę zawodową albo stanowisko. Nie używaj saveUserName do tych danych.",
      inputSchema: z.object({
        company: z.string().min(1).max(160).optional().describe("Firma lub pracodawca użytkownika."),
        jobTitle: z.string().min(1).max(160).optional().describe("Stanowisko lub rola zawodowa użytkownika."),
      }),
      execute: async ({ company, jobTitle }) =>
        saveUserDetails(supabase, profileId, { company, jobTitle }),
    }),
  };
}

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

function extractWorkDetailsFromMessage(message: string) {
  const companyMatch = message.match(
    /\b(?:pracuj(?:ę|e) w|w firmie|moja firma to)\s+([^.,;!?\n]+?)(?:\s+jako\s+|[.,;!?\n]|$)/iu,
  );
  const jobTitleMatch = message.match(
    /\b(?:jako|stanowisko(?: to)?|jestem)\s+([^.,;!?\n]+?)(?:\s+w firmie\s+|[.,;!?\n]|$)/iu,
  );

  return {
    company: companyMatch?.[1]?.trim() || undefined,
    jobTitle: jobTitleMatch?.[1]?.trim() || undefined,
  };
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return Response.json(
      { error: "Wymagane jest zalogowanie." },
      { status: 401 },
    );
  }

  const { supabase, user } = auth;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      {
        error:
          "Brak GOOGLE_GENERATIVE_AI_API_KEY. Utworz plik .env.local i wpisz w nim klucz Google AI Studio.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    modelMode?: "flash" | "pro";
    userId?: unknown;
  };

  const messages = body.messages?.filter((message) => message.content.trim().length > 0) ?? [];
  const profileId = user.id;
  const { profile: loadedProfile, error: profileError } =
    await getOrCreateUserProfile(supabase, profileId);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content;
  const detectedName = lastUserMessage ? extractNameFromMessage(lastUserMessage) : null;
  const detectedWorkDetails = lastUserMessage
    ? extractWorkDetailsFromMessage(lastUserMessage)
    : { company: undefined, jobTitle: undefined };
  const savedFacts: string[] = [];
  let profile = loadedProfile;

  if (profileId && detectedName) {
    const savedName = await saveUserName(supabase, profileId, detectedName);

    if (savedName.saved && profile) {
      profile = { ...profile, name: savedName.name ?? profile.name };
      savedFacts.push("imię użytkownika");
    }
  }

  if (profileId && (detectedWorkDetails.company || detectedWorkDetails.jobTitle)) {
    const savedDetails = await saveUserDetails(
      supabase,
      profileId,
      detectedWorkDetails,
    );

    if (savedDetails.saved && profile) {
      profile = {
        ...profile,
        preferences: {
          ...profile.preferences,
          ...(detectedWorkDetails.company ? { firma: detectedWorkDetails.company } : {}),
          ...(detectedWorkDetails.jobTitle ? { stanowisko: detectedWorkDetails.jobTitle } : {}),
        },
      };
      if (detectedWorkDetails.company) {
        savedFacts.push("firma użytkownika");
      }
      if (detectedWorkDetails.jobTitle) {
        savedFacts.push("stanowisko użytkownika");
      }
    }
  }

  const savedFactsPrompt = savedFacts.length
    ? `\n\nFAKT SYSTEMOWY: Automatyczny zapis do Supabase POWIÓDŁ SIĘ. Zapisano: ${savedFacts.join(", ")}. Nie uruchamiaj ponownie narzędzia zapisu dla tych samych danych. Nie wspominaj o problemie technicznym, braku pamięci ani nieudanym zapisie. Potwierdź użytkownikowi zapis w naturalny sposób.`
    : "";
  const personalizedSystemPrompt = `${systemPrompt}${getProfilePrompt(profile, profileError)}${savedFactsPrompt}`;
  const tools = {
    ...createBaseTools(supabase, profileId),
    ...createProfileTools(supabase, profileId),
  };

  if (messages.length === 0) {
    return Response.json({ error: "Brak wiadomosci do przetworzenia." }, { status: 400 });
  }

  try {
    const result = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: personalizedSystemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(maxSteps),
      maxRetries: 1,
      temperature: 0.2,
    });

    const failedMemoryClaim = /problem techniczny|nie mog[ęe] (tego )?zapisa[ćc]|nie mam (?:dostępu|trwałej pamięci)/iu;
    const responseText =
      savedFacts.length > 0 && failedMemoryClaim.test(result.text)
        ? `### Wynik końcowy\nZapisałem w Twoim profilu: ${savedFacts.join(", ")}. Będę korzystać z tych informacji w kolejnych rozmowach.`
        : result.text;

    return new Response(responseText, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się uruchomić agenta ReAct.";
    const friendlyMessage = message.toLowerCase().includes("spending cap")
      ? "Projekt Google AI przekroczył miesięczny limit wydatków. Zmień limit w AI Studio albo użyj innego klucza GOOGLE_GENERATIVE_AI_API_KEY w .env.local."
      : message;

    return Response.json(
      {
        error: friendlyMessage,
      },
      { status: 500 },
    );
  }
}
