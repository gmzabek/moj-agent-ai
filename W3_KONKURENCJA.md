# Warsztat 3: Analiza konkurencji — agent porównuje firmy

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_KONKURENCJA.md i zbuduj stronę /competitor. Podaję nazwy 3 firm → agent szuka info, porównuje w tabeli, pisze rekomendacje."*

## Cel
Strona `/competitor` — podajesz nazwy firm → agent szuka o nich informacje, porównuje w tabeli i pisze rekomendację.

## Kontekst
W W1 agent sortował maile, w W2 pisał raporty. Teraz trzeci scenariusz: analiza konkurencji. Podajesz 3 nazwy firm → agent szuka, porównuje, rekomenduje.

## Co budujemy

### 1. Endpoint `/api/competitor`

```
Stwórz endpoint: app/api/competitor/route.ts

Model: gemini-3.1-flash-lite z useSearchGrounding sterowanym zmienną ENABLE_SEARCH_GROUNDING (domyślnie wyłączony — patrz L03 W1)
maxSteps: 10

Narzędzia: readWebPage, searchWikipedia

System prompt:
"Jesteś analitykiem konkurencji. Gdy użytkownik poda nazwy firm,
AUTONOMICZNIE zbierasz informacje i porównujesz je.

## TWÓJ PROCES:
1. Dla KAŻDEJ firmy: szukaj informacji (Google, Wikipedia, strony firmowe)
2. Zbierz: opis, branża, wielkość, produkty, ceny, mocne/słabe strony
3. Stwórz tabelę porównawczą
4. Napisz rekomendację

## FORMAT:

# 🏢 Analiza konkurencji

## Porównanie

| Aspekt | [Firma 1] | [Firma 2] | [Firma 3] |
|--------|-----------|-----------|-----------|
| Branża | ... | ... | ... |
| Wielkość | ... | ... | ... |
| Główny produkt | ... | ... | ... |
| Mocne strony | ... | ... | ... |
| Słabe strony | ... | ... | ... |
| Ceny (orientacyjne) | ... | ... | ... |

## Szczegółowa analiza
[Rozwinięcie dla każdej firmy — 3-4 zdania]

## Rekomendacja
[Która firma jest najlepsza i dlaczego — w kontekście użytkownika]

## Źródła
[Linki do stron firmowych i artykułów]"
```

### 2. Strona `/competitor`

```
Stwórz stronę app/competitor/page.tsx:

Nagłówek: "🏢 Analiza konkurencji"
Podtytuł: "Podaj firmy — agent porówna je za Ciebie"

Elementy:
1. 3 pola input: "Firma 1", "Firma 2", "Firma 3"
   Placeholdery: "Np. Shopify", "Np. WooCommerce", "Np. PrestaShop"
2. Opcjonalnie: "Kontekst" (textarea) — "Szukam platformy e-commerce dla małego sklepu"
3. Przycisk "🔍 Porównaj"
4. Wynik: tabela + analiza + rekomendacja

Klikalne przykłady:
- Shopify vs WooCommerce vs PrestaShop
- Notion vs Obsidian vs Evernote
- Vercel vs Netlify vs Railway
- ChatGPT vs Claude vs Gemini

Przycisk "📋 Kopiuj analizę" przy wyniku.
```

### 3. Link w nawigacji

```
Dodaj "🏢 Konkurencja" do nawigacji.
```

## Test

1. Podaj: Shopify, WooCommerce, PrestaShop
   - Agent szuka o każdej firmie → tabela porównawcza → rekomendacja ✅
2. Podaj: ChatGPT, Claude, Gemini
   - Agent porównuje modele AI → tabela z cenami i features ✅

## Dlaczego to jest ważne
Analiza konkurencji to zadanie które każdy menedżer potrzebuje ale nienawidzi robić. Godziny szukania, porównywania, formatowania. Agent robi to w minutę z prawdziwymi danymi. "Mój agent porównał 3 firmy i dał rekomendację w 60 sekund."
