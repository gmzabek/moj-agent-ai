# Warsztat 4: Twój własny scenariusz — zbuduj co chcesz

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Zbuduj mi stronę [NAZWA] która [OPIS FUNKCJI]. Użyj narzędzi agenta: Google Search, Wikipedia, kalkulator. Strona powinna mieć [SZCZEGÓŁY]."*

## Cel
Wymyśl WŁASNY scenariusz biznesowy i powiedz AI assistantowi żeby go zbudował. To jest Twój moment — budujesz coś co TY potrzebujesz.

## Kontekst
Przez 3 warsztaty zbudowaliśmy gotowe scenariusze: e-mail triage, generator raportów, analizę konkurencji. Teraz TWOJA kolej — wymyśl scenariusz który jest przydatny DLA CIEBIE.

## Jak to zrobić

### 1. Wymyśl scenariusz
Pomyśl: "Jakie zadanie w pracy/życiu zabiera mi dużo czasu i jest powtarzalne?"

**Inspiracje:**
- 📝 **Podsumowanie spotkania** — wklej notatki ze spotkania → agent pisze minutkę z action items
- 📱 **Generator postów social media** — podaj temat → agent pisze 3 wersje posta (LinkedIn, Twitter, Instagram)
- 📋 **Analizator CV** — wklej CV → agent ocenia, sugeruje poprawki, pisze feedback
- 🍽️ **Planer posiłków** — podaj preferencje dietetyczne → agent planuje tydzień z przepisami
- 💼 **Analizator oferty pracy** — wklej ofertę → agent porównuje z Twoim profilem, pisze cover letter
- 🎓 **Generator quizu** — podaj temat → agent tworzy 10 pytań z odpowiedziami
- 📖 **Streszczacz artykułów** — wklej URL → agent czyta stronę i pisze streszczenie w 3 zdaniach
- 🏠 **Kalkulator kosztów remontu** — opisz co chcesz zrobić → agent szacuje koszty

### 2. Stwórz prompt dla AI assistanta

Szablon:
```
"Zbuduj mi stronę /[NAZWA] w mojej aplikacji Next.js.

FUNKCJA:
[Opisz co strona robi — 2-3 zdania]

INTERFEJS:
- Pole: [co user wpisuje/wkleja]
- Przycisk: [nazwa]
- Wynik: [jak wygląda odpowiedź]
- Przykłady: [2-3 klikalne przykłady]

NARZĘDZIA:
Agent powinien używać: [Google Search / readWebPage / calculator / searchWikipedia]

STYL:
Spójny z resztą aplikacji — ciemny motyw, karty, glassmorphism.
Dodaj link do nawigacji: [emoji + nazwa]"
```

### 3. Przykład gotowego promptu

```
"Zbuduj mi stronę /meeting-summary w mojej aplikacji Next.js.

FUNKCJA:
Wklejam surowe notatki ze spotkania → agent robi profesjonalne podsumowanie
z agendą, decyzjami, action items i deadline'ami.

INTERFEJS:
- Pole textarea: 'Wklej notatki ze spotkania...'
- Przycisk: '📋 Podsumuj spotkanie'
- Wynik: ładnie sformatowane podsumowanie z sekcjami
- Przykłady: 2 zestawy przykładowych notatek do kliknięcia

NARZĘDZIA:
Nie potrzeba narzędzi zewnętrznych — wystarczy gemini-3.1-flash-lite.
Ale jeśli w notatkach jest firma → searchWikipedia żeby dodać kontekst.

STYL:
Spójny z resztą aplikacji. Dodaj '📋 Spotkania' do nawigacji."
```

### 4. Testuj i iteruj

Po zbudowaniu:
1. Przetestuj z prawdziwymi danymi (Twoje notatki, Twoje oferty, Twoje texty)
2. Jeśli wynik nie jest idealny → powiedz AI assistantowi co zmienić
3. "Agent za dużo pisze — ogranicz do 5 zdań na sekcję"
4. "Dodaj przycisk kopiowania przy każdej sekcji"
5. Iteruj aż będziesz zadowolony

## Oczekiwany rezultat
- TWOJA strona z TWOIM scenariuszem
- Działający agent który rozwiązuje TWÓJ problem
- Link w nawigacji
- Coś co faktycznie CHCESZ używać

## Test
Przetestuj na minimum 3 prawdziwych przykładach (nie wymyślonych).
Pokaż efekt prowadzącemu i kolegom z kursu.

## Dlaczego to jest ważne
Do tej pory budowaliśmy to co ja wymyśliłem. Teraz budujesz to co TY wymyśliłeś. "Zbudowałem coś co JA potrzebuję" — to jest moment gdy kurs się opłaca. AI assistant buduje. Ty projektujesz. To jest przyszłość pracy z AI.
