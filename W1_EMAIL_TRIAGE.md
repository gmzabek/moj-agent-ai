# Warsztat 1: E-mail triage — agent sortuje pocztę

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W1_EMAIL_TRIAGE.md i zbuduj stronę /email-triage. Wklejam 5 maili → agent kategoryzuje, priorytetyzuje i pisze draft odpowiedzi."*

## Cel
Strona `/email-triage` — wklejasz maile, agent automatycznie je kategoryzuje (pilne/ważne/spam), priorytetyzuje i pisze szkice odpowiedzi.

## Kontekst
Do tej pory agent odpowiadał na PYTANIA. Ale prawdziwy agent wykonuje ZADANIA. "Posortuj mi pocztę" to nie pytanie — to misja. Agent musi: przeczytać, zrozumieć, skategoryzować, spriorytetyzować i napisać draft.

To jest pierwszy scenariusz biznesowy — konkretny, zrozumiały, użyteczny.

## Co budujemy

### 1. Endpoint `/api/email-triage`

```
Stwórz endpoint: app/api/email-triage/route.ts

Przyjmij POST z JSON: { emails: string[] } (tablica tekstów maili)

Model: gemini-3.1-flash-lite
Odpowiedź: streamText (streaming)

System prompt:
"Jesteś profesjonalnym asystentem do zarządzania pocztą.

Dla KAŻDEGO maila wykonaj:
1. 📧 KATEGORYZACJA: określ typ (zapytanie ofertowe / reklamacja / spam / informacja / prośba o spotkanie)
2. 🔴🟡🟢 PRIORYTET: Wysoki (wymaga odpowiedzi dziś) / Średni (w ciągu 3 dni) / Niski (może poczekać)
3. ✍️ DRAFT: Napisz krótki, profesjonalny szkic odpowiedzi (3-5 zdań)

FORMAT ODPOWIEDZI:
Dla każdego maila:

### Mail [numer]: [krótki temat]
| Kategoria | [typ] |
| Priorytet | [🔴 Wysoki / 🟡 Średni / 🟢 Niski] |
| Uzasadnienie | [dlaczego ten priorytet] |

**Proponowana odpowiedź:**
> [draft odpowiedzi]

---

Na końcu: PODSUMOWANIE
- 🔴 Pilne: [ile] maili
- 🟡 Średnie: [ile] maili
- 🟢 Niskie: [ile] maili
- ✅ Rekomendacja: [który mail obsłużyć najpierw]"
```

### 2. Strona `/email-triage`

```
Stwórz stronę app/email-triage/page.tsx:

Nagłówek: "📧 E-mail Triage"
Podtytuł: "Wklej maile — agent posortuje i napisze odpowiedzi"

Interfejs:
1. Pole textarea (duże, min 200px wysokość):
   - Placeholder: "Wklej maile tutaj — oddziel je pustą linią..."
2. Przycisk "📧 Analizuj maile"
3. Pod przyciskiem: wynik (streaming) w ładnych kartach

Przykładowe maile do wklejenia (przycisk "📋 Wklej przykład"):

Mail 1 - PILNY:
Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.

Mail 2 - SPAM:
Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Mail 3 - OFERTA:
Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Mail 4 - REKLAMACJA:
Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło ale nie dostaje maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.

Mail 5 - INFO:
Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.

Renderowanie wyniku:
- Każdy mail = karta z kolorowym wskaźnikiem priorytetu
- 🔴 = czerwona ramka, 🟡 = żółta, 🟢 = zielona
- Draft odpowiedzi w cytacie (blockquote)
- Podsumowanie na górze: "2 pilne, 1 średni, 2 niskie"
- Przycisk "Kopiuj draft" przy każdej proponowanej odpowiedzi
```

### 3. Link w nawigacji

```
Dodaj "📧 E-mail Triage" do nawigacji.
```

## Oczekiwany rezultat
- Strona /email-triage z polem do wklejania maili
- Agent analizuje każdy mail: kategoria + priorytet + draft odpowiedzi
- Kolorowe karty z priorytetami
- Podsumowanie na końcu z rekomendacją
- Przycisk kopiowania draftów

## Test

1. Wklej 5 przykładowych maili (podane wyżej)
2. Agent powinien:
   - 🔴 Mail 1 (faktura) → PILNY, draft korekty
   - 🔴 Mail 4 (reklamacja) → PILNY, draft przeprosin + rozwiązanie
   - 🟡 Mail 3 (współpraca) → ŚREDNI, draft umówienia spotkania
   - 🟢 Mail 5 (newsletter) → NISKI, brak odpowiedzi
   - 🗑️ Mail 2 (spam) → SPAM, brak odpowiedzi
3. Podsumowanie: "2 pilne, 1 średni, 1 niski, 1 spam. Zacznij od maila 1 (termin jutro)."

## Dlaczego to jest ważne
To jest pierwszy scenariusz gdzie agent realizuje MISJĘ, nie odpowiada na pytanie. "Posortuj mi pocztę" to zadanie menedżera — agent robi je w 3 sekundy. Pokaż to szefowi: "Wrzuciłem 5 maili → agent posortował i napisał odpowiedzi." To jest moment gdy ludzie rozumieją wartość AI.
