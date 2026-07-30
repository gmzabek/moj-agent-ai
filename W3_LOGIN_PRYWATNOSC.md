# Warsztat 3: Login i prywatne rozmowy

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W3_LOGIN_PRYWATNOSC.md i dodaj logowanie przez Supabase Auth. Każdy zalogowany user ma widzieć TYLKO swoje rozmowy."*

## Cel
Dodać logowanie (email + hasło) i izolację danych — każdy user widzi TYLKO swoje rozmowy, swoje dokumenty, swój profil.

## Kontekst
Agent jest w internecie (W2) ale każdy kto wejdzie widzi WSZYSTKO — wszystkie rozmowy, wszystkie dokumenty. Brak prywatności. Dziś dodajemy login i izolację danych per user.

## Co budujemy

### 1. Strona /login

```
Stwórz stronę /login z formularzem:
- Email + hasło
- Przycisk "Zaloguj się"
- Przycisk "Zarejestruj się" (lub toggle)
- Wylogowanie: przycisk "Wyloguj" w nawigacji

Użyj Supabase Auth:
- signUp: supabase.auth.signUp({ email, password })
- signIn: supabase.auth.signInWithPassword({ email, password })
- signOut: supabase.auth.signOut()
- getUser: supabase.auth.getUser()

Chronione strony:
- Niezalogowany → automatyczny redirect na /login
- Strony chronione: /, /history, /upload (wszystko poza /login)
```

### 2. Izolacja danych per user

```
Zmodyfikuj istniejące tabele — dodaj kolumnę user_id:

W Supabase Dashboard → Table Editor:
- conversations: dodaj kolumnę user_id (uuid, NOT NULL)
- documents: dodaj kolumnę user_id (uuid)
- user_profiles: zmień id na auth.uid()

ALBO poproś AI assistanta o migration SQL:
ALTER TABLE conversations ADD COLUMN user_id uuid;
ALTER TABLE documents ADD COLUMN user_id uuid;
```

### 3. Filtrowanie danych per user

```
Zmodyfikuj WSZYSTKIE zapytania do Supabase żeby filtrować po user_id:

ODCZYT conversations:
  BYŁO: supabase.from('conversations').select('*').order('updated_at', { ascending: false })
  JEST: supabase.from('conversations').select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

ZAPIS conversation:
  BYŁO: supabase.from('conversations').insert({ title: ... })
  JEST: supabase.from('conversations').insert({ title: ..., user_id: user.id })

ODCZYT/ZAPIS documents — analogicznie dodaj .eq('user_id', user.id)

Pobierz user.id z: const { data: { user } } = await supabase.auth.getUser()
```

### 4. Wyczyść stare dane

```
Stare dane (z L05-L06) nie mają user_id — będą "sierocinami".
Najprościej: DELETE FROM conversations WHERE user_id IS NULL
Powiedz AI assistantowi: "Wyczyść stare dane bez user_id z tabel conversations i documents."
```

## Oczekiwany rezultat
- Strona /login z formularzem email + hasło ✅
- Rejestracja nowego konta → login → czat ✅
- Niezalogowany → redirect na /login ✅
- Login jako Jan → widzisz TYLKO rozmowy Jana ✅
- Wyloguj → Login jako Ewa → widzisz TYLKO rozmowy Ewy ✅

## Test

1. Otwórz stronę → redirect na /login ✅
2. Zarejestruj się jako jan@test.com
3. Napisz do agenta → rozmowa zapisana
4. Wyloguj → Zarejestruj się jako ewa@test.com
5. Historia → PUSTA (Ewa nie ma rozmów) ✅
6. Napisz do agenta → rozmowa Ewy
7. Wyloguj → Zaloguj jako Jan → rozmowa Jana nadal jest ✅
8. `git add . && git commit -m "Add auth" && git push` → Vercel redeploy ✅

## Dlaczego to jest ważne
Bez logowania → demo. Z logowaniem → produkt. To jest **multi-tenancy** — jeden system, wielu użytkowników, izolowane dane. Tak działa KAŻDY SaaS: Notion, Slack, ChatGPT.
