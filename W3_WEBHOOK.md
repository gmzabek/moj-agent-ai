# Warsztat 3: Webhook — agent reaguje na zdarzenia

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_WEBHOOK.md i zbuduj endpoint /api/webhook. Przyjmuje JSON z danymi → agent analizuje → zapisuje wynik w Supabase."*

## Cel
Endpoint `/api/webhook` — przyjmuje dane JSON z zewnątrz, agent je analizuje i zapisuje wynik. Jak "telefon do agenta" — ktoś dzwoni, agent odpowiada.

## Co budujemy

### 1. Endpoint `/api/webhook`

```
Stwórz endpoint: app/api/webhook/route.ts

Metoda: POST
Przyjmuje JSON: { type: string, data: any }

Typy zdarzeń (obsłuż minimum 2):

A) type: "feedback"
   data: { customer: "Jan Kowalski", rating: 3, comment: "Średnia obsługa" }
   → Agent analizuje feedback: sentiment, priorytet, sugestia odpowiedzi
   → Zapis do Supabase: tabela webhook_events

B) type: "alert"
   data: { service: "API", status: "down", since: "2026-07-13T08:00:00Z" }
   → Agent analizuje alert: severity, recommended action
   → Zapis do Supabase

C) type: "order" (opcjonalnie)
   data: { product: "Premium", customer: "anna@test.com", amount: 299 }
   → Agent potwierdza, generuje podsumowanie

Odpowiedź: { success: true, analysis: "...", event_id: "uuid" }
```

### 2. Tabela `webhook_events`

```
Stwórz tabelę:
- id: uuid, gen_random_uuid()
- created_at: timestamptz, now()
- type: text (feedback/alert/order)
- data: jsonb (oryginalne dane)
- analysis: text (analiza agenta)
```

### 3. Test z curl/fetch

```
Test z przeglądarki (DevTools → Console):

fetch('/api/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'feedback',
    data: { customer: 'Jan', rating: 2, comment: 'Długi czas oczekiwania na odpowiedź' }
  })
}).then(r => r.json()).then(console.log)

Sprawdź: Supabase → webhook_events → rekord z analizą agenta!
```

## Test
1. Wyślij webhook "feedback" z niskim rating → agent analizuje negatywny feedback ✅
2. Wyślij webhook "alert" → agent sugeruje akcję ✅
3. Supabase → webhook_events → 2 rekordy z analizami ✅

## Dlaczego to jest ważne
Webhook = agent reaguje na zdarzenia BEZ interakcji człowieka. Klient wypełnia ankietę → webhook → agent analizuje. Serwer pada → webhook → agent diagnozuje. To jest integracja z zewnętrznym światem.
