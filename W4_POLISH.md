# Warsztat 4: Finalny polish — og:image, favicon, PWA, ciemny/jasny motyw

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_POLISH.md i dodaj: og:image (preview w social media), favicon, PWA manifest (ikona na telefonie), ciemny/jasny motyw."*

## Cel
Dodać finalny polish: og:image, favicon, PWA manifest, theme toggle. Aplikacja wygląda jak prawdziwy produkt.

## Co budujemy

### 1. og:image — preview w social media
```
Gdy ktoś wklei link do Twojej apki na LinkedIn/Twitter/Slack:
- Wyświetli się ładny podgląd z tytułem i opisem

W app/layout.tsx lub app/page.tsx dodaj metadata:
export const metadata = {
  title: 'Atlas AI — Twój osobisty asystent',
  description: 'Agent AI z bazą wiedzy, pamięcią i automatyzacją.',
  openGraph: {
    title: 'Atlas AI',
    description: 'Twój osobisty asystent AI',
    images: ['/og-image.png'],  // 1200x630px
  }
}

Stwórz og-image.png (1200x630) — nazwa agenta + krótki opis.
Użyj Canva, Figma, lub poproś AI assistanta o wygenerowanie.
```

### 2. Favicon
```
Dodaj favicon:
- public/favicon.ico (32x32) — ikona w karcie przeglądarki
- public/icon.png (512x512) — ikona PWA

Poproś AI assistanta lub użyj favicon generator online.
```

### 3. PWA manifest
```
Dodaj public/manifest.json:
{
  "name": "Atlas AI",
  "short_name": "Atlas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#9CF983",
  "icons": [{ "src": "/icon.png", "sizes": "512x512", "type": "image/png" }]
}

W app/layout.tsx dodaj: <link rel="manifest" href="/manifest.json" />

Efekt: na telefonie można "Dodaj do ekranu głównego" → ikona jak natywna apka.
```

### 4. Ciemny/jasny motyw (toggle)
```
Dodaj przycisk 🌙/☀️ w nawigacji:
- Domyślnie: ciemny motyw (jak dotychczas)
- Kliknięcie: przełącz na jasny motyw
- Zapisz preferencję w localStorage

CSS: użyj zmiennych CSS:
:root { --bg: #0a0a0a; --text: #ededed; }
[data-theme="light"] { --bg: #ffffff; --text: #1a1a1a; }
```

## Test
1. Wklej link na Slack/LinkedIn → ładny podgląd z og:image ✅
2. Karta przeglądarki → favicon ✅
3. Telefon → "Dodaj do ekranu" → ikona jak apka ✅
4. Toggle ciemny/jasny → przełącza się ✅

## Dlaczego to jest ważne
Detale decydują. og:image, favicon, PWA — to są rzeczy które odróżniają "projekt szkolny" od "produktu". Gdy wklejasz link na LinkedIn i wyświetla się ładny podgląd — ludzie klikają. To jest profesjonalizm.
