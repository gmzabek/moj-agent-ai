import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { saveBriefing } from "@/lib/briefings.server";
import {
  currentDateTime,
  getBibleQuote,
  getExchangeRate,
  getMarketOverview,
  getPolishDayContext,
  getPulsBiznesuEdition,
  getTopNews,
  getUnusualHolidayContext,
  getWeather,
} from "@/lib/morningData.server";

const MODEL_ID = "gemini-3.1-flash-lite";

const systemPrompt = `Jesteś osobistym asystentem. Napisz poranny briefing po polsku w formacie:

# ☀️ Dzień dobry! Twój briefing na [data]

## 🌤️ Pogoda
[temperatura, opis, co ubrać]

## 💶 Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## 📈 Giełdy
### USA
- [Microsoft, Nvidia i Amazon jako Nasdaq; Novo Nordisk ADR jako NYSE]

### GPW
- [WIG20 oraz kursy PKO BP, Orlenu, PZU, KGHM i CD Projekt]

[Dodaj krótką informację, że notowania są informacyjne i mogą być opóźnione.]

## 🗞️ Przegląd aktualnego wydania „Pulsu Biznesu”
- [4–7 najważniejszych tematów wydania; każdy temat krótko sparafrazuj i podlinkuj, jeśli przekazano link]

## 📰 Najważniejsze wiadomości
- [3–5 krótkich punktów opartych wyłącznie na przekazanych nagłówkach]

## 📅 Dzisiejszy dzień
- Dzień tygodnia: [...]
- Święto ustawowe lub dzień wolny: [...]
- Nietypowe święta: [...]

## 📖 Cytat z Biblii
„[dokładnie przekazany cytat]” — [siglum lub pełne odwołanie], [przekazany przekład]

## 💡 Porada dnia
[Krótka, pozytywna i konkretna porada na dzień]

Zasady:
- Nie wymyślaj faktów i nie dodawaj danych spoza wejścia.
- Zachowaj dokładnie podane kursy, waluty, zmiany procentowe i datę notowania.
- Nie nazywaj MSFT, NVDA ani AMZN akcjami NYSE — są notowane na Nasdaq. NVO jest notowane na NYSE.
- Przegląd PB ma być zwięzłą parafrazą, a nie kopią leadów ani całych artykułów.
- Jeśli opcjonalne źródło jest niedostępne, napisz krótko „dane chwilowo niedostępne” i kontynuuj briefing.
- Cytat biblijny przytocz dokładnie, bez przerabiania, i pozostaw go w języku angielskim.
- Nie twórz linków, jeśli nie ma ich w danych.
- Nie dodawaj wstępu ani zakończenia poza wskazanym formatem.`;

function optionalSource<T>(
  task: Promise<T>,
  source: string,
): Promise<T | { source: string; error: string }> {
  return task.catch((error: unknown) => ({
    source,
    error:
      error instanceof Error
        ? error.message
        : `Nie udało się pobrać danych: ${source}.`,
  }));
}

export function getMorningBriefingErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Przekroczono czas oczekiwania na zewnętrzne źródło danych.";
    }

    return error.message;
  }

  return "Nieznany błąd podczas generowania briefingu.";
}

export async function generateAndSaveMorningBriefing(userId?: string) {
  const dateTime = currentDateTime();
  const [
    weather,
    eur,
    usd,
    dayContext,
    news,
    marketOverview,
    pulsBiznesu,
    unusualHolidays,
  ] = await Promise.all([
    getWeather("Warszawa"),
    getExchangeRate("EUR"),
    getExchangeRate("USD"),
    getPolishDayContext(dateTime),
    getTopNews(5),
    optionalSource(getMarketOverview(), "Yahoo Finance"),
    optionalSource(getPulsBiznesuEdition(7), "Puls Biznesu"),
    optionalSource(
      getUnusualHolidayContext(dateTime),
      "kalendarz świąt nietypowych Kalbi.pl",
    ),
  ]);

  const sourceData = {
    dateTime,
    dayContext,
    unusualHolidays,
    weather,
    exchangeRates: [eur, usd],
    marketOverview,
    pulsBiznesu,
    news,
    bibleQuote: getBibleQuote(dateTime.date),
  };

  const { text } = await generateText({
    model: google(MODEL_ID),
    system: systemPrompt,
    prompt:
      "Przygotuj poranny briefing wyłącznie na podstawie tych danych:\n\n" +
      JSON.stringify(sourceData, null, 2),
    temperature: 0.25,
  });
  const content = text.trim();

  if (!content) {
    throw new Error("Model AI zwrócił pusty briefing.");
  }

  const saved = await saveBriefing({
    content,
    date: dateTime.date,
    user_id: userId ?? null,
  });

  return {
    content,
    date: dateTime.date,
    id: saved.id,
  };
}
