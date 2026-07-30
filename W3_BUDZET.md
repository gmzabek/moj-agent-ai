# Warsztat 3: Budżet kosztów — kontrola zużycia tokenów

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_BUDZET.md i dodaj tabelę api_usage w Supabase. Każde wywołanie liczy tokeny. Gdy user przekroczy 10k tokenów/dzień → 'Wróć jutro'."*

## Cel
Tabela `api_usage` w Supabase. Każde wywołanie API loguje zużycie tokenów. Limit 10k tokenów/dzień per user.

## Co budujemy

### 1. Tabela `api_usage`
```
Stwórz tabelę w Supabase:
- id: uuid
- user_id: uuid
- created_at: timestamptz
- tokens_input: integer (tokeny w pytaniu)
- tokens_output: integer (tokeny w odpowiedzi)
- model: text (np. "gemini-3.1-flash-lite")
- endpoint: text (np. "/api/chat", "/api/react")
```

### 2. Logowanie zużycia
```
Po KAŻDYM wywołaniu LLM:
1. Pobierz token usage z response (Vercel AI SDK daje to w metadata)
2. Zapisz do api_usage: { user_id, tokens_input, tokens_output, model, endpoint }
```

### 3. Limit dzienny
```
Przed KAŻDYM wywołaniem LLM:
1. Policz tokeny usera z dzisiejszego dnia:
   SELECT SUM(tokens_input + tokens_output) FROM api_usage
   WHERE user_id = ? AND created_at >= today()
2. Jeśli > 10000: "Dzienny limit tokenów (10k) został wyczerpany. Wróć jutro!"
```

## Test
1. Prowadź rozmowy → Supabase api_usage rośnie ✅
2. Przekrocz limit (obniż do 100 tokenów do testu) → "Wróć jutro" ✅

## Dlaczego to jest ważne
Bez budżetu jeden user może wygenerować rachunek $100 w ciągu godziny. Kontrola kosztów to fundamentalna produkcyjna funkcja.
