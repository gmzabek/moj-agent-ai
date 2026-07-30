import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DAILY_TOKEN_LIMIT = 10_000;
export const DAILY_TOKEN_LIMIT_MESSAGE =
  "Dzienny limit tokenów (10k) został wyczerpany. Wróć jutro!";

type UsageValue = number | null | undefined;

export type TokenUsageLike = {
  inputTokens?: UsageValue;
  outputTokens?: UsageValue;
  promptTokens?: UsageValue;
  completionTokens?: UsageValue;
  promptTokenCount?: UsageValue;
  candidatesTokenCount?: UsageValue;
};

function toTokenCount(value: UsageValue) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export function normalizeTokenUsage(usage: TokenUsageLike | null | undefined) {
  return {
    tokensInput: toTokenCount(
      usage?.inputTokens ?? usage?.promptTokens ?? usage?.promptTokenCount,
    ),
    tokensOutput: toTokenCount(
      usage?.outputTokens ??
        usage?.completionTokens ??
        usage?.candidatesTokenCount,
    ),
  };
}

export function getDailyTokenLimit() {
  const configured = Number(process.env.API_DAILY_TOKEN_LIMIT);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_DAILY_TOKEN_LIMIT;
}

function parseDailyUsage(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Supabase zwrócił nieprawidłowe zużycie tokenów.");
  }

  return Math.round(parsed);
}

export async function getDailyApiUsage(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_my_daily_api_usage");

  if (error) {
    throw new Error(`Nie udało się sprawdzić budżetu tokenów: ${error.message}`);
  }

  return parseDailyUsage(data);
}

export async function assertDailyTokenBudget(supabase: SupabaseClient) {
  const used = await getDailyApiUsage(supabase);
  const limit = getDailyTokenLimit();

  if (used >= limit) {
    throw new Error(DAILY_TOKEN_LIMIT_MESSAGE);
  }

  return { limit, used };
}

export async function enforceDailyTokenBudget(supabase: SupabaseClient) {
  try {
    await assertDailyTokenBudget(supabase);

    return null;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === DAILY_TOKEN_LIMIT_MESSAGE
    ) {
      return Response.json({ error: DAILY_TOKEN_LIMIT_MESSAGE }, { status: 429 });
    }

    console.error("API usage budget check failed:", error);
    return Response.json(
      {
        error:
          "Nie udało się sprawdzić dziennego limitu tokenów. Spróbuj ponownie później.",
      },
      { status: 503 },
    );
  }
}

export async function recordApiUsage({
  supabase,
  userId,
  usage,
  model,
  endpoint,
}: {
  supabase: SupabaseClient;
  userId: string;
  usage: TokenUsageLike | null | undefined;
  model: string;
  endpoint: string;
}) {
  const { tokensInput, tokensOutput } = normalizeTokenUsage(usage);
  const { error } = await supabase.from("api_usage").insert({
    user_id: userId,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    model,
    endpoint,
  });

  if (error) {
    throw new Error(`Nie udało się zapisać zużycia tokenów: ${error.message}`);
  }

  return { tokensInput, tokensOutput };
}

export async function recordEmbeddingUsage({
  supabase,
  userId,
  estimatedInputTokens,
  endpoint,
}: {
  supabase: SupabaseClient;
  userId: string;
  estimatedInputTokens: number;
  endpoint: string;
}) {
  return recordApiUsage({
    supabase,
    userId,
    usage: { inputTokens: estimatedInputTokens, outputTokens: 0 },
    model: "gemini-embedding-2",
    endpoint,
  });
}
