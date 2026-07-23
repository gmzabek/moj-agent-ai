# Warsztat 2: Deploy na Vercel — agent w internecie

> ⚠️ **Ten warsztat prowadzący prowadzi krok po kroku na ekranie.**
> Studenci robią to samo na swoich komputerach.

## Cel
Wrzucić agenta do internetu — publiczny link `twoja-apka.vercel.app`. Od teraz każdy `git push` = automatyczny redeploy.

## Kontekst
Kod jest na GitHubie (W1). Teraz podłączamy Vercel — serwis który bierze kod z GitHuba, buduje go i wystawia w internet. Za darmo. Bez konfiguracji serwera.

## Krok po kroku

### 1. Załóż konto Vercel

```
1. Wejdź na vercel.com
2. Kliknij "Sign Up" → "Continue with GitHub"
3. Autoryzuj Vercel do dostępu do GitHuba
4. Gotowe — dashboard Vercel
```

### 2. Importuj projekt

```
1. Kliknij "Add New..." → "Project"
2. "Import Git Repository" → znajdź swoje repo (moj-agent-ai)
3. Jeśli nie widzisz repo → kliknij "Adjust GitHub App Permissions" → dodaj repo
4. Framework Preset: Next.js (powinien się wykryć automatycznie)
5. NIE klikaj jeszcze Deploy!
```

### 3. Environment Variables

```
Na stronie "Configure Project" → rozwiń "Environment Variables":

Dodaj KAŻDĄ zmienną z pliku .env.local:

| Nazwa | Skąd wziąć |
|-------|------------|
| GOOGLE_GENERATIVE_AI_API_KEY | Google AI Studio |
| NEXT_PUBLIC_SUPABASE_URL | Supabase Dashboard → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase Dashboard → Settings → API |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard → Settings → API |

WAŻNE: Skopiuj DOKŁADNIE z .env.local — bez spacji na początku/końcu.
Najłatwiej: otwórz .env.local, kopiuj nazwę i wartość jedna po drugiej.
```

### 4. Deploy!

```
1. Kliknij "Deploy"
2. Poczekaj 1-2 minuty — Vercel buduje
3. Zielony ✅ → "Congratulations!"
4. Twój link: twoja-apka.vercel.app
5. Kliknij → Twoja apka w internecie!
```

### 5. Test na telefonie

```
1. Wyślij link sobie na telefon (SMS, email, Slack)
2. Otwórz na telefonie
3. Porozmawiaj z agentem
4. Sprawdź w Supabase — rozmowa się zapisała!

DZIAŁA! 🎉
```

## Test
1. Otwórz link na komputerze → apka działa ✅
2. Otwórz na telefonie → responsive, działa ✅
3. Porozmawiaj z agentem → odpowiada ✅
4. Odśwież → historia rozmów (Supabase) działa ✅

## Troubleshooting

| Problem | Rozwiązanie |
|---------|-------------|
| "Build failed" | Vercel → Deployments → kliknij build → logi → znajdź błąd |
| "Error 500" / pusta strona | Brak env vars → Vercel Dashboard → Settings → Environment Variables → dodaj → Redeploy |
| "GOOGLE_API_KEY undefined" | Nazwa zmiennej musi być DOKŁADNIE taka jak w kodzie |
| "Nie widzę repo" | Vercel → Settings → Git → "Adjust GitHub App Permissions" |
| "Apka działa ale agent nie odpowiada" | Sprawdź GOOGLE_GENERATIVE_AI_API_KEY w env vars |

## Od teraz
Każdy `git push` = automatyczny redeploy. Zmieniasz kod → commit → push → 1 minuta → nowa wersja online. W kolejnych warsztatach (W3, W4) każda zmiana automatycznie pojawi się na Vercel.

## Dlaczego to jest ważne
Localhost = "u mnie działa". Vercel = "otwórz ten link na telefonie". To jest moment gdy projekt staje się produktem. Możesz wysłać link szefowi, klientowi, mamie.
