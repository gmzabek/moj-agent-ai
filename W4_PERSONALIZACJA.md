# Warsztat 4: Agent personalny — wita po imieniu

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_PERSONALIZACJA.md i zrób żeby agent witał mnie po imieniu. Przy pierwszej rozmowie pyta o imię, potem pamięta."*

## Cel
Agent pyta o imię przy pierwszej rozmowie i zapamiętuje. Przy kolejnych wita: "Cześć, Paweł!". Szybka personalizacja — 15 minut.

## Co budujemy

### 1. Profil użytkownika

```
Użyj istniejącej tabeli user_profiles z L05.
Upewnij się że jest powiązana z auth user id (z W3).

Profil zawiera:
- display_name: imię użytkownika
- preferences: JSONB (opcjonalnie — ulubione jedzenie, miasto itp.)

Przy REJESTRACJI (W3): stwórz pusty profil (display_name = null)
Agent sprawdza: jeśli display_name jest null → pyta o imię.
```

### 2. System prompt z imieniem

```
Zmodyfikuj system prompt agenta:

BYŁO (statyczny):
"Jesteś pomocnym asystentem AI."

JEST (dynamiczny per user):
"Jesteś pomocnym asystentem AI.
Rozmawiasz z użytkownikiem: {display_name || 'nieznany'}.
Jeśli nie znasz imienia użytkownika — zapytaj grzecznie na początku rozmowy."

Pobierz display_name z user_profiles WHERE id = auth.user.id
```

### 3. Zapamiętaj imię

```
Gdy user poda imię ("Jestem Paweł", "Mam na imię Ewa"):
- Agent odpowiada: "Miło Cię poznać, Paweł! Zapamiętam."
- Zapisz w user_profiles: UPDATE SET display_name = 'Paweł'
- Od teraz agent wita: "Cześć, Paweł!"

Najprościej: dodaj narzędzie updateUserName do agenta.
```

## Test

1. Zaloguj jako nowy user → agent pyta o imię ✅
2. Powiedz "Jestem Paweł" → agent zapamiętuje ✅
3. Odśwież stronę → "Cześć, Paweł!" ✅
4. `git add . && git commit -m "Add personalization" && git push` → Vercel update ✅

## Dlaczego to jest ważne
"Cześć!" vs "Cześć, Paweł!" — mała zmiana, ogromna różnica w doświadczeniu użytkownika.
