# Warsztat 4: Panel bezpieczeństwa — /admin/security

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W4_PANEL_BEZPIECZENSTWA.md i zbuduj stronę /admin/security — logi podejrzanych wiadomości, top 5 userów po zużyciu, alerty."*

## Cel
Strona `/admin/security` — dashboard bezpieczeństwa: zablokowane wiadomości, zużycie per user, alerty.

## Co budujemy

### Strona `/admin/security`
```
Stwórz stronę app/admin/security/page.tsx:

Nagłówek: "🛡️ Panel bezpieczeństwa"

Sekcje:
1. "⚠️ Zablokowane wiadomości" — lista wiadomości zablokowanych przez walidację
   (z tabeli message_logs WHERE blocked = true)
   Pokaż: user, wiadomość (skrócona), powód blokady, data

2. "📊 Top 5 użytkowników po zużyciu" — kto zużywa najwięcej tokenów
   (z tabeli api_usage: GROUP BY user_id, SUM tokens)
   Pokaż: email, tokeny dziś, tokeny w tym tygodniu, % limitu

3. "🔴 Alerty" — podejrzane zachowania
   - User który osiągnął 80% limitu
   - User który wysłał >20 wiadomości w 10 minut
   - Wiadomość zablokowana przez filtr

4. "📈 Statystyki" — ogólne
   - Łączne tokeny dziś / tydzień
   - Liczba zablokowanych wiadomości
   - Średnie zużycie per user
```

## Test
1. Spróbuj atak z W1 → pojawia się w "Zablokowane wiadomości" ✅
2. Prowadź 10 rozmów → widać w "Top użytkowników" ✅

## Dlaczego to jest ważne
Nie wystarczy się bronić — trzeba WIDZIEĆ co się dzieje. Panel bezpieczeństwa to Twoje oczy — widzisz kto próbuje złamać agenta i ile kosztuje Cię każdy user.
