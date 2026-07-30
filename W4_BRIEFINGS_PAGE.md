# Warsztat 4: Strona briefingów — dashboard automatycznych raportów

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_BRIEFINGS_PAGE.md i zbuduj stronę /briefings — lista wygenerowanych briefingów z datami. Najnowszy na górze."*

## Cel
Strona `/briefings` — lista automatycznie wygenerowanych briefingów (z cron joba). Najnowszy na górze. Kliknięcie → pełna treść.

## Co budujemy

### 1. Strona `/briefings`

```
Stwórz stronę app/briefings/page.tsx:

Nagłówek: "📰 Briefingi"
Podtytuł: "Automatyczne podsumowania dnia od Twojego agenta"

Pobierz z Supabase:
SELECT * FROM briefings ORDER BY created_at DESC LIMIT 30

Dla każdego briefingu pokaż kartę:
- Data (np. "13 lipca 2026, poniedziałek")
- Podgląd (pierwsze 150 znaków)
- Status: ✅ wygenerowany automatycznie (z cron)
- Kliknięcie → pełna treść

Pusta lista → "Brak briefingów. Cron job wygeneruje pierwszy jutro rano!"
z przyciskiem "🔄 Wygeneruj teraz" (ręczne wywołanie /api/cron/morning)

Przycisk "🔄 Wygeneruj teraz" na górze (przy nagłówku)
— wywołuje /api/cron/morning ręcznie i odświeża listę.
```

### 2. Podgląd briefingu

```
Kliknięcie na kartę → pełna treść briefingu:
- Renderuj markdown (pogoda, waluty, porada dnia)
- Przycisk "← Wróć do listy"
- Przycisk "📋 Kopiuj" (treść do schowka)

Można użyć dynamicznej strony app/briefings/[id]/page.tsx
lub modala/drawer na tej samej stronie.
```

### 3. Link w nawigacji

```
Dodaj "📰 Briefingi" do nawigacji.
Badge z liczbą nowych briefingów (opcjonalnie).
```

## Test
1. Kliknij "Wygeneruj teraz" → nowy briefing na liście ✅
2. Kliknij na briefing → pełna treść z pogodą i walutami ✅
3. Wygeneruj 3 razy → 3 karty na liście (najnowszy na górze) ✅

## Dlaczego to jest ważne
To jest dashboard automatycznych raportów. Rano otwierasz telefon → strona /briefings → "Dzień dobry! Pogoda 24°C, EUR 4.28 PLN, dziś poniedziałek." Agent przygotował to o 7 rano, bez Twojego udziału. To jest autonomiczny asystent.
