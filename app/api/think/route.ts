import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import {
  enforceDailyTokenBudget,
  recordApiUsage,
} from "../../../lib/apiUsage.server";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

// AI SDK 5 uses stopWhen as the supported equivalent of maxSteps: 3.
const maxSteps = 3;

const systemPrompt = `Jesteś analitykiem. Twoim zadaniem jest MYŚLEĆ NA GŁOS.

Gdy dostajesz pytanie, MUSISZ przejść przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 - Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 - Fakty:**
Co wiem na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 - Analiza:**
Jakie są 2-3 możliwe podejścia/odpowiedzi?

**Krok 4 - Ocena:**
Które podejście jest najlepsze? DLACZEGO?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- ZAWSZE pokaż CAŁY proces myślenia - użytkownik widzi jak pracujesz
- Używaj nagłówków markdown do oddzielenia kroków
- Krok "Myślę" powinien być DŁUŻSZY niż finalna odpowiedź
- Odpowiadaj po polsku`;

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
        endpoint: "/api/think",
      });
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof Error ? error.message : "Nieznany błąd po stronie API.",
  });
}
