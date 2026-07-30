# Warsztat 2: Cron job na Vercel — agent budzi się sam

> ⚠️ **Ten warsztat łączy prompt do AI assistanta z konfiguracją ręczną.**
> Część kodu — AI assistant. Konfiguracja vercel.json — Ty ręcznie (1 linia).

> 📋 **Skopiuj i wklej do AI assistanta:**
> *"Przeczytaj plik W2_CRON_JOB.md i dodaj do vercel.json konfigurację cron job który odpala /api/cron/morning codziennie o 7:00 UTC."*

## Cel
Skonfigurować cron job na Vercel — endpoint `/api/cron/morning` odpala się automatycznie codziennie o 7:00 UTC (9:00 polskiego czasu).

## Co budujemy

### 1. Dodaj cron do vercel.json

```
W pliku vercel.json (w katalogu głównym projektu) dodaj sekcję crons:

{
  "crons": [
    {
      "path": "/api/cron/morning",
      "schedule": "0 7 * * *"
    }
  ]
}

Wyjaśnienie schedule (format cron):
  0  7  *  *  *
  │  │  │  │  │
  │  │  │  │  └── dzień tygodnia (0-7, * = każdy)
  │  │  │  └───── miesiąc (1-12, * = każdy)
  │  │  └──────── dzień miesiąca (1-31, * = każdy)
  │  └─────────── godzina (0-23, 7 = 7:00 UTC = 9:00 PL latem)
  └────────────── minuta (0-59, 0 = o pełnej godzinie)

Czyli: codziennie o 7:00 UTC → 9:00 rano w Polsce (czas letni).
```

### 2. Zabezpiecz endpoint

```
Dodaj sprawdzenie że endpoint jest wywoływany przez Vercel Cron (nie przez przypadkowego usera):

W app/api/cron/morning/route.ts:

export async function GET(request: Request) {
  // Sprawdź header — Vercel dodaje go automatycznie
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // ... reszta logiki briefingu
}

Dodaj CRON_SECRET do .env.local i do Vercel Environment Variables.

ALBO prostsza wersja (bez auth):
Po prostu zostaw endpoint otwarty — to jest Twoja apka, nikt go nie znajdzie.
```

### 3. Deploy na Vercel

```
Deploy żeby cron zadziałał:

git add .
git commit -m "Add morning briefing cron job"
git push

Vercel automatycznie deploy'uje i rejestruje cron job.
Sprawdź w Vercel Dashboard → Settings → Cron Jobs → powinien być widoczny.
```

### 4. Weryfikacja

```
Po deploy:
1. Vercel Dashboard → twój projekt → Settings → Cron Jobs
   → widzisz: /api/cron/morning, schedule: 0 7 * * *
2. Kliknij "Trigger" (ręczne uruchomienie) → sprawdź czy briefing się wygenerował
3. Supabase → briefings → nowy rekord!
4. Jutro rano sprawdź czy cron odpalił się automatycznie
```

## Test
1. vercel.json ma sekcję crons ✅
2. Deploy na Vercel ✅
3. Vercel Dashboard → Cron Jobs → widoczny ✅
4. Ręczne Trigger → briefing w Supabase ✅
5. **JUTRO RANO:** sprawdź Supabase → nowy briefing! 🎉

## Dlaczego to jest ważne
Agent odpalił się SAM. Bez Twojej interakcji. O 7 rano zbiera dane i przygotowuje briefing. To jest autonomia — agent pracuje gdy TY śpisz. Jeden wiersz w vercel.json — a agent działa 24/7.
