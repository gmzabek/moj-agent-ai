# Warsztat 1: Landing page — pierwsze wrażenie

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_LANDING_PAGE.md i zbuduj landing page na stronie głównej / (dla niezalogowanych). Piękna strona: nazwa agenta, opis, screenshoty, przycisk 'Zacznij za darmo'."*

## Cel
Strona `/` dla niezalogowanych = profesjonalna landing page z nazwą agenta, opisem, CTA i screenshotami.

## Co budujemy

### Strona główna `/` — conditional rendering
```
Zmodyfikuj app/page.tsx:

JEŚLI user zalogowany → pokaż czat (jak dotychczas)
JEŚLI user NIE zalogowany → pokaż landing page

Landing page:
1. Hero section:
   - Nazwa agenta (Twoja nazwa! np. "Atlas AI", "Nexus", "Mira")
   - Tagline: 1 zdanie (np. "Twój osobisty asystent AI z bazą wiedzy firmy")
   - Przycisk CTA: "🚀 Zacznij za darmo" → /login
   - Opcjonalnie: animowany gradient w tle

2. Features (3-4 karty):
   - 🧠 "Pamięta Twoje rozmowy"
   - 📚 "Zna dokumenty Twojej firmy"
   - 🔐 "Prywatne dane per user"
   - ⚡ "Pracuje 24/7 (cron jobs)"

3. Demo section:
   - Screenshot lub mockup interfejsu
   - "Zapytaj o cennik → agent odpowiada z TWOICH dokumentów"

4. CTA footer:
   - "Gotowy? Zacznij w 30 sekund."
   - Przycisk: "Stwórz konto" → /login

Styl: glassmorphism, gradient, animacje fade-in. Premium look.
```

## Test
1. Wyloguj się → strona / = landing page z CTA ✅
2. Kliknij "Zacznij za darmo" → /login → rejestracja → czat ✅
3. Landing page wygląda PROFESJONALNIE ✅

## Dlaczego to jest ważne
Pierwsze wrażenie decyduje czy ktoś zostanie. Landing page to "okładka" Twojego produktu.
