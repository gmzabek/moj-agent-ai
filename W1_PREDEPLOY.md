# Warsztat 1: Pre-deploy — GitHub i pierwszy commit

> ⚠️ **Ten warsztat prowadzący prowadzi krok po kroku na ekranie.**
> Studenci robią to samo na swoich komputerach.

## Cel
Przygotować kod do deploy'u — założyć repo na GitHubie i zrobić commit. Po tym warsztacie kod jest "w chmurze" na GitHubie, gotowy do podłączenia Vercel.

## Kontekst
Do tej pory pracowaliśmy na localhost. Kod jest TYLKO na Twoim komputerze. Jeśli dysk padnie — tracisz wszystko. GitHub = backup + wersjonowanie + Vercel go potrzebuje.

## Krok po kroku

### 1. Załóż konto GitHub (jeśli nie masz)

```
1. Wejdź na github.com
2. Kliknij "Sign up"
3. Email → hasło → nazwa użytkownika (np. jan-kowalski-ai)
4. Zweryfikuj email
5. Gotowe!
```

### 2. Zainstaluj Git (jeśli nie masz)

```
Sprawdź czy masz:
  W terminalu wpisz: git --version
  Jeśli widzisz numer wersji → masz Git, przejdź dalej.

Jeśli NIE masz:
  Windows: https://git-scm.com/download/win → pobierz → zainstaluj (Next, Next, Finish)
  Mac: w terminalu wpisz: xcode-select --install

Po instalacji skonfiguruj:
  git config --global user.name "Twoje Imię"
  git config --global user.email "twoj@email.com"
```

### 3. Stwórz repozytorium na GitHubie

```
1. Na github.com kliknij "+" (prawy górny róg) → "New repository"
2. Repository name: moj-agent-ai (lub dowolna nazwa)
3. Description: "Agent AI z kursem Laba"
4. Visibility: Public ✅ (łatwiejsze, działa z Vercel free)
5. NIE zaznaczaj "Add a README file" (mamy już kod)
6. Kliknij "Create repository"
7. GitHub pokaże instrukcje — ZOSTAW TĘ STRONĘ OTWARTĄ
```

### 4. Dodaj .gitignore

```
Poproś AI assistanta:
"Stwórz plik .gitignore dla projektu Next.js. Dodaj .env.local do ignorowanych plików."

WAŻNE: .env.local z kluczami API NIGDY nie idzie na GitHuba!
```

### 5. Pierwszy commit i push

```
W terminalu (w katalogu projektu):

git init
git add .
git commit -m "Agent AI: chatbot + narzędzia + Supabase + RAG"
git branch -M main
git remote add origin https://github.com/TWOJ-LOGIN/moj-agent-ai.git
git push -u origin main

Prowadzący pokaże każdy krok na ekranie.
```

### 6. Sprawdź na GitHubie

```
1. Odśwież stronę repozytorium na GitHubie
2. Widzisz swoje pliki? ✅
3. NIE widzisz .env.local? ✅ (dobrze — klucze są prywatne)
```

## Test
- github.com/TWOJ-LOGIN/moj-agent-ai → widzisz pliki ✅
- .env.local NIE jest widoczny ✅
- Folder node_modules NIE jest widoczny ✅

## Troubleshooting

| Problem | Rozwiązanie |
|---------|-------------|
| "git: command not found" | Zainstaluj Git (krok 2) |
| "Permission denied" | GitHub → Settings → Developer Settings → Personal access token → wygeneruj |
| "remote origin already exists" | `git remote remove origin` → powtórz `git remote add` |
| ".env.local jest na GitHubie!" | Dodaj do .gitignore, potem: `git rm --cached .env.local` → commit → push |

## Dlaczego to jest ważne
GitHub to standard — każdy developer trzyma tam kod. Ale dla nas najważniejsze: Vercel czyta kod z GitHuba i automatycznie deploy'uje. Bez GitHuba = bez Vercela = bez agenta w internecie.
