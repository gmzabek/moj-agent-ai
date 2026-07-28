import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { saveBriefing } from "@/lib/briefings.server";
import {
  currentDateTime,
  getExchangeRate,
  getPolishDayContext,
  getTopNews,
  getWeather,
} from "@/lib/morningData.server";

const MODEL_ID = "gemini-3.1-flash-lite";

const systemPrompt = `Jesteś osobistym asystentem. Napisz zwięzły poranny briefing po polsku w formacie:

# ☀️ Dzień dobry! Twój briefing na [data]

## 🌤️ Pogoda
[temperatura, opis, co ubrać]

## 💶 Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## 📰 Najważniejsze wiadomości
- [3–5 krótkich punktów opartych wyłącznie na przekazanych nagłówkach]

## 📅 Dzisiejszy dzień
- Dzień tygodnia: [...]
- Uwagi: [czy dziś święto lub dzień wolny]

## 💡 Porada dnia
[Krótka, pozytywna i konkretna porada na dzień]

Zasady:
- Nie wymyślaj faktów i nie dodawaj danych spoza wejścia.
- Zachowaj dokładnie podane wartości kursów oraz jednostki pogodowe.
- Nie twórz linków, jeśli nie ma ich w danych.
- Nie dodawaj wstępu ani zakończenia poza wskazanym formatem.`;

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
  const [weather, eur, usd, dayContext, news] = await Promise.all([
    getWeather("Warszawa"),
    getExchangeRate("EUR"),
    getExchangeRate("USD"),
    getPolishDayContext(dateTime),
    getTopNews(5),
  ]);

  const sourceData = {
    dateTime,
    dayContext,
    weather,
    exchangeRates: [eur, usd],
    news,
  };

  const { text } = await generateText({
    model: google(MODEL_ID),
    system: systemPrompt,
    prompt:
      "Przygotuj poranny briefing wyłącznie na podstawie tych danych:\n\n" +
      JSON.stringify(sourceData, null, 2),
    temperature: 0.35,
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
