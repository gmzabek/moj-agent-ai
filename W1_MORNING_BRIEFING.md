# Warsztat 1: Morning briefing — endpoint automatyczny

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_MORNING_BRIEFING.md i zbuduj endpoint /api/cron/morning. Pobiera pogodę, kursy walut, wiadomości. Generuje podsumowanie dnia. Zapisuje w Supabase."*

## Cel
Endpoint API który agent odpala automatycznie — zbiera pogodę, kursy walut, najważniejsze wiadomości i generuje "morning briefing". Zapisuje wynik w Supabase.

## Kontekst
Agent do tej pory działa TYLKO gdy ktoś z nim rozmawia. Piszesz → odpowiada. Ale prawdziwy asystent przygotowuje rzeczy ZANIM zapytasz. Dziś budujemy endpoint który agent może odpalić SAM — rano o 7:00 — i przygotować Ci podsumowanie dnia.

## Co budujemy

### 1. Endpoint `/api/cron/morning`

```
Stwórz endpoint: app/api/cron/morning/route.ts

Metoda: GET (cron jobs wywołują GET)

Działanie:
1. Pobierz pogodę: getWeather("Warszawa") (reuse z L04)
2. Pobierz kursy: getExchangeRate("EUR"), getExchangeRate("USD")
3. Pobierz datę: currentDateTime
4. Wygeneruj briefing przez AI (gemini-3.1-flash-lite):

System prompt:
"Jesteś osobistym asystentem. Napisz poranny briefing w formacie:

# ☀️ Dzień dobry! Twój briefing na [data]

## 🌤️ Pogoda
[temperatura, opis, co ubrać]

## 💶 Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## 📅 Dzisiejszy dzień
- Dzień tygodnia: [...]
- Uwagi: [czy dziś święto? dzień wolny?]

## 💡 Porada dnia
[Krótka, pozytywna porada na dzień]"

5. Zapisz briefing w Supabase:
   - Tabela: briefings (stwórz jeśli nie istnieje)
   - Kolumny: id (uuid), created_at (timestamptz), content (text), date (date)

6. Zwróć: { success: true, date: "2026-07-13", preview: "..." }
```

### 2. Tabela `briefings` w Supabase

```
Stwórz tabelę (Table Editor lub AI assistant):
- id: uuid, gen_random_uuid()
- created_at: timestamptz, now()
- content: text — pełna treść briefingu (markdown)
- date: date — data briefingu
- user_id: uuid — (opcjonalnie, per user)
```

### 3. Test endpointu ręcznie

```
Zanim skonfigurujemy cron — przetestuj ręcznie:

W przeglądarce: http://localhost:3000/api/cron/morning

Powinien zwrócić JSON:
{
  "success": true,
  "date": "2026-07-13",
  "preview": "☀️ Dzień dobry! Pogoda w Warszawie: 24°C..."
}

Sprawdź w Supabase Dashboard → briefings → nowy rekord!
```

## Oczekiwany rezultat
- Endpoint `/api/cron/morning` — GET → generuje briefing
- Briefing z pogodą, kursami walut, datą
- Zapis do Supabase (tabela briefings)
- Testowanie ręczne przez przeglądarkę

## Test
1. Otwórz http://localhost:3000/api/cron/morning
2. Poczekaj ~5 sekund → JSON z success: true ✅
3. Supabase → briefings → nowy rekord z briefingiem ✅

## Dlaczego to jest ważne
To jest fundament automatyki. Endpoint istnieje niezależnie od użytkownika — można go wywoływać z zewnątrz, o zadanej godzinie, bez ludzkiej interakcji. Agent przygotuje Ci podsumowanie dnia ZANIM wstaniesz z łóżka.
