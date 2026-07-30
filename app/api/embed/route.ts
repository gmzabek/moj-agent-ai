import { NextResponse } from "next/server";
import {
  enforceDailyTokenBudget,
  recordEmbeddingUsage,
} from "../../../lib/apiUsage.server";
import {
  estimateEmbeddingTokens,
  generateEmbedding,
} from "../../../lib/embeddings";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);
  if (!auth) return NextResponse.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  const budgetResponse = await enforceDailyTokenBudget(auth.supabase);
  if (budgetResponse) return budgetResponse;

  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Pole text jest wymagane." },
        { status: 400 },
      );
    }

    const embedding = await generateEmbedding(text);
    await recordEmbeddingUsage({
      supabase: auth.supabase,
      userId: auth.user.id,
      estimatedInputTokens: estimateEmbeddingTokens(text),
      endpoint: "/api/embed",
    });

    return NextResponse.json({ embedding });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się wygenerować embeddingu.",
      },
      { status: 500 },
    );
  }
}
