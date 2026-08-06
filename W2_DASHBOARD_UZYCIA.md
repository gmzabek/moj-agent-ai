# Warsztat 2: Dashboard użycia — statystyki agenta

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_DASHBOARD_UZYCIA.md i zbuduj stronę /admin/dashboard — ile rozmów, ile userów, ile tokenów, ile kosztuje dziennie. Wykresy."*

## Cel
Strona `/admin/dashboard` — ile rozmów, userów, tokenów zużyto, ile kosztuje dziennie. Wykresy i liczby.

## Co budujemy

### Strona `/admin/dashboard`
```
Stwórz stronę app/admin/dashboard/page.tsx:

Nagłówek: "📊 Dashboard"

Karty z liczbami (na górze):
- 👥 Użytkownicy: COUNT DISTINCT user_id FROM conversations
- 💬 Rozmowy: COUNT FROM conversations
- 🔤 Tokeny dziś: SUM tokens FROM api_usage WHERE today
- 💰 Koszt dziś: (tokeny * cena_per_token) — np. $0.15/1M input tokens

Wykresy (poniżej):
- Linia: tokeny per dzień (ostatnie 7 dni)
- Bar: rozmowy per dzień (ostatnie 7 dni)
- Pie: tokeny per endpoint (/chat, /react, /report, /email-triage)

Użyj biblioteki: recharts (npm install recharts)
lub Chart.js, lub czyste SVG.

Tabela: "Ostatnie rozmowy"
- 10 ostatnich rozmów: user email, tytuł, data, ile wiadomości
```

## Test
1. Dane z Supabase ładują się → karty z liczbami ✅
2. Wykresy pokazują trend ostatnich 7 dni ✅
3. Tabela z ostatnimi rozmowami ✅

## Dlaczego to jest ważne
Dashboard to jak deska rozdzielcza w samochodzie — widzisz ile paliwa (tokenów) zużywasz, ile km (rozmów) przejechałeś, kto jedzie (userzy). Bez dashboardu prowadzisz na ślepo.
