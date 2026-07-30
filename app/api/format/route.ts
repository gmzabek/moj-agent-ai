import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import {
  enforceDailyTokenBudget,
  recordApiUsage,
} from "../../../lib/apiUsage.server";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

// AI SDK 5 uses stopWhen as the supported equivalent of maxSteps: 3.
const maxSteps = 3;

const systemPrompt = `Jesteś asystentem który formatuje odpowiedzi według instrukcji użytkownika.

Rozpoznajesz komendy formatu na początku wiadomości:

/tabela [temat] - odpowiedz w formie tabeli markdown
  Kolumny dobierz do tematu. Minimum 3 kolumny, 5 wierszy.
  Przykład: /tabela porównanie frameworków JavaScript

/lista [temat] - odpowiedz jako lista numerowana z opisami
  Każdy punkt: numer + nagłówek (bold) + 1 zdanie opisu
  Przykład: /lista 10 zasad dobrego kodu

/porownanie [A] vs [B] - tabela porównawcza dwóch rzeczy
  Kolumny: Aspekt | [A] | [B] | Werdykt
  Minimum 6 aspektów + wiersz podsumowania
  Przykład: /porownanie React vs Vue

/faq [temat] - lista pytań i odpowiedzi
  Format: **Q:** pytanie → **A:** odpowiedź
  Minimum 5 par Q&A
  Przykład: /faq praca zdalna

/email [opis] - napisz profesjonalny email
  Format: Temat | Od/Do | Treść | Podpis
  Przykład: /email prośba o urlop na 2 tygodnie

Jeśli wiadomość NIE zaczyna się od komendy - odpowiadaj normalnie, ale w czystym, czytelnym markdown.

ZAWSZE formatuj w markdown: nagłówki, pogrubienia, tabele, listy.
Odpowiadaj po polsku.`;

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser(req).catch(() => null);
  if (!auth) return Response.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  const budgetResponse = await enforceDailyTokenBudget(auth.supabase);
  if (budgetResponse) return budgetResponse;

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(maxSteps),
    onEnd: async ({ usage }) => {
      await recordApiUsage({
        supabase: auth.supabase,
        userId: auth.user.id,
        usage,
        model: "gemini-3.1-flash-lite",
        endpoint: "/api/format",
      });
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof Error ? error.message : "Nieznany błąd po stronie API.",
  });
}
