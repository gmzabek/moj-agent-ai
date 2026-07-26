# Warsztat 2: Generator raportów — agent pisze za Ciebie

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_RAPORTY.md i zbuduj stronę /report. Opisuję temat → agent szuka w Google, analizuje, pisze raport z sekcjami i wnioskami. Przycisk Kopiuj."*

## Cel
Strona `/report` — podajesz temat → agent autonomicznie szuka informacji, analizuje i generuje profesjonalny raport biznesowy z sekcjami, danymi i wnioskami.

## Kontekst
W Warsztacie 1 agent sortował maile — prosta misja "przeczytaj i skategoryzuj". Teraz dajemy mu trudniejsze zadanie: **napisz raport na dany temat**. Agent musi: szukać, analizować, strukturyzować i pisać.

## Co budujemy

### 1. Endpoint `/api/report`

```
Stwórz endpoint: app/api/report/route.ts

Model: gemini-3.1-flash-lite z useSearchGrounding sterowanym zmienną ENABLE_SEARCH_GROUNDING (domyślnie wyłączony — patrz L03 W1)
maxSteps: 8

Narzędzia: readWebPage, searchWikipedia, calculator
(te same co w L04 — reuse!)

System prompt:
"Jesteś profesjonalnym analitykiem biznesowym. Gdy użytkownik poda temat, 
AUTONOMICZNIE zbierasz informacje i piszesz raport.

## TWÓJ PROCES:
1. Przeanalizuj temat — co trzeba zbadać?
2. Szukaj danych: Google Search, Wikipedia, strony branżowe
3. Zbierz fakty, liczby, statystyki
4. Napisz raport w profesjonalnym formacie

## FORMAT RAPORTU:

# 📊 Raport: [TEMAT]
Data: [dzisiejsza data]
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania — kluczowe wnioski]

## 1. Wprowadzenie
[Kontekst, dlaczego ten temat jest ważny]

## 2. Kluczowe dane i fakty
[Wylistowane punkty z danymi — ze źródłami]

## 3. Analiza
[Interpretacja danych, trendy, porównania]

## 4. Wnioski i rekomendacje
[Co z tego wynika? Co robić?]

## Źródła
[Lista użytych źródeł z linkami]

ZASADY:
- Używaj PRAWDZIWYCH danych — Google Search, Wikipedia
- Podawaj źródła przy każdym fakcie
- Bądź konkretny — liczby, daty, nazwy
- Raport powinien mieć 500-1000 słów
- Nie wymyślaj statystyk — szukaj!"
```

### 2. Strona `/report`

```
Stwórz stronę app/report/page.tsx:

Nagłówek: "📊 Generator raportów"
Podtytuł: "Opisz temat — agent napisze raport biznesowy"

Elementy:
1. Pole input: "O czym ma być raport?"
   Placeholder: "Np. Rynek AI w Polsce w 2026 roku..."
2. Przycisk "📊 Generuj raport"
3. Wynik: renderuj markdown raportu w ładnym formacie

Klikalne przykłady:
- "Rynek AI w Polsce — trendy, firmy, prognozy na 2026"
- "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop"
- "Wpływ pracy zdalnej na produktywność — badania i statystyki"
- "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy"

Przyciski akcji przy gotowym raporcie:
- "📋 Kopiuj do schowka" (cały raport jako tekst)
- "💾 Zapisz w bazie" (opcjonalnie — zapis do Supabase)
```

### 3. Link w nawigacji

```
Dodaj "📊 Raporty" do nawigacji.
```

## Oczekiwany rezultat
- Strona /report z polem na temat
- Agent szuka w Google, analizuje, pisze raport z sekcjami
- Raport ma: streszczenie, dane, analizę, wnioski, źródła
- Przycisk "Kopiuj" do łatwego wklejenia np. do emaila

## Test

1. "Rynek AI w Polsce w 2026 roku" →
   - Agent szuka w Google (grounding)
   - Raport z 4 sekcjami, źródłami, konkretnymi danymi ✅

2. "Porównanie Next.js vs Nuxt.js" →
   - Agent szuka obu technologii
   - Tabela porównawcza + rekomendacja ✅

3. Kliknij "Kopiuj" → wklej do emaila/dokumentu → gotowy raport ✅

## Dlaczego to jest ważne
Generowanie raportów to jedno z najcenniejszych zastosowań AI w biznesie. "Napisz mi raport o rynku" — to zadanie które normalnie zajmuje 2-4 godziny. Agent robi to w minutę. Z prawdziwymi danymi, źródłami i formatowaniem. To jest automatyzacja pracy umysłowej.
