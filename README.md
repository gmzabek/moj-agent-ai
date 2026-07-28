# Lekcja 09 — Morning briefing

Endpoint `GET /api/cron/morning`:

1. pobiera pogodę w Warszawie z Open-Meteo,
2. pobiera kursy EUR i USD z NBP,
3. sprawdza datę, dzień tygodnia i polskie święta,
4. pobiera bieżące nagłówki z RSS,
5. generuje briefing modelem `gemini-3.1-flash-lite`,
6. zapisuje wynik w tabeli `briefings` w Supabase.

## Uruchomienie

1. Skopiuj `.env.example` do `.env.local` i uzupełnij wartości.
2. Wykonaj migrację `supabase/migrations/20260728000000_briefings.sql` w Supabase.
3. Uruchom `npm install`, a następnie `npm run dev`.
4. Wywołaj endpoint z nagłówkiem autoryzacji, na przykład:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  http://localhost:3000/api/cron/morning
```

## Automatyczne uruchamianie na Vercel

Plik `vercel.json` rejestruje zadanie cron wywołujące
`/api/cron/morning` codziennie o `07:00 UTC`.

Endpoint wymaga zmiennej `CRON_SECRET`. Dodaj tę samą wartość:

1. lokalnie w `.env.local`,
2. w ustawieniach projektu Vercel: Environment Variables.

Vercel Cron automatycznie wysyła ją w nagłówku:

```text
Authorization: Bearer <CRON_SECRET>
```

## Webhook zdarzeń

Endpoint `POST /api/webhook` przyjmuje zdarzenia `feedback`, `alert` i `order`,
analizuje je przez Gemini, a następnie zapisuje oryginalne dane i analizę
w tabeli `webhook_events`.

Przed użyciem wykonaj migrację:

```text
supabase/migrations/20260728010000_webhook_events.sql
```

Przykładowy test:

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"feedback","data":{"customer":"Jan","rating":2,"comment":"Długi czas oczekiwania na odpowiedź"}}'
```
