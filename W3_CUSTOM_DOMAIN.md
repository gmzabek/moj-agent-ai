# Warsztat 3: Custom domain — Twój własny adres

> ⚠️ **Ten warsztat jest klikaniem w GUI — prowadzący prowadzi krok po kroku.**

## Cel
Dodać własną domenę do aplikacji na Vercel. Zamiast `random-name.vercel.app` → `twoj-agent.pl`.

## Krok po kroku

### 1. Kup domenę (opcjonalnie)
- Tani registrar: OVH.pl, nazwa.pl, Cloudflare Registrar
- Darmowa subdomena: jeśli masz już domenę (np. firma.pl) → dodaj agent.firma.pl
- Nie masz domeny? Zmień nazwę projektu w Vercel → `twoja-nazwa.vercel.app` i oglądaj resztę na ekranie prowadzącego

### 2. Dodaj domenę w Vercel
1. Vercel Dashboard → Twój projekt → Settings → Domains
2. Wpisz domenę: `agent.twojafirma.pl` (subdomena) lub `twoj-agent.pl` (cała domena)
3. Vercel pokaże, co dodać u registrara — **przepisuj wartości z tego ekranu, nie z tej instrukcji** (Vercel podaje je indywidualnie dla projektu)

### 3. Skonfiguruj DNS — wybierz JEDNĄ z 2 opcji

**Opcja A: rekord A (domena zostaje u registrara)**
```
U registrara dodaj rekord:
  Typ: A
  Nazwa: @
  Wartość: [IP, które pokazuje Vercel — np. 216.150.1.1]

Kiedy: chcesz zostawić DNS u registrara (np. działa tam poczta) i zmienić tylko to,
gdzie prowadzi strona.

UWAGA: IP przepisz z ekranu Vercela — jest różne dla różnych projektów.
Starsze poradniki podają 76.76.21.21; nadal działa, ale nie wpisuj go w ciemno.
```

**Opcja B: DNS zarządza Vercel**
```
U registrara podmień nameservery na te, które pokaże Vercel (ns1.vercel-dns.com itp.)

Kiedy: domena jest tylko pod agenta. Vercel ustawia wszystko sam — zero grzebania w rekordach.
UWAGA: przejmuje CAŁĄ domenę. Jeśli działa na niej poczta lub inna strona — wybierz opcję A.
```

Po zmianie poczekaj na propagację: rekord A zwykle kilka minut, nameservery nawet do kilku godzin.

### 4. Weryfikacja
1. Vercel Dashboard → Domains → status: ✅ Valid Configuration
2. SSL/HTTPS: Vercel automatycznie generuje certyfikat
3. Otwórz: `https://twoj-agent.pl` → Twoja aplikacja!

## Test
1. Vercel Dashboard → Domains → domena widoczna z zielonym ✅
2. Otwórz URL w przeglądarce → Twoja apka ✅
3. HTTPS działa (kłódka w pasku adresu) ✅

> ⏳ **Jeśli DNS jeszcze nie zdążył się rozpropagować — to normalne.**
> Idziemy dalej do W4, domena zaskoczy w tle. Sprawdź ją po zajęciach.

## Dlaczego to jest ważne
`random-xyz.vercel.app` brzmi amatorsko. `twoj-agent.pl` brzmi profesjonalnie. Custom domain = marka = zaufanie.
