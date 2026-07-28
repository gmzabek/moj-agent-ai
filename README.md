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
4. Otwórz `http://localhost:3000/api/cron/morning`.

Jeśli ustawisz `CRON_SECRET`, wywołanie musi zawierać nagłówek:

```text
Authorization: Bearer <CRON_SECRET>
```
