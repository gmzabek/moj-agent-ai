import type { SupabaseClient } from "@supabase/supabase-js";

export type SecurityLogStage = "input" | "output" | "rate_limit";

function createExcerpt(message: string) {
  const normalized = message
    .normalize("NFKC")
    .replace(/[\p{Cc}\u200B-\u200D\u2060\uFEFF]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return normalized.length > 180
    ? `${normalized.slice(0, 177).trimEnd()}...`
    : normalized;
}

export async function recordSecurityMessage({
  supabase,
  userId,
  message,
  blocked = false,
  blockReason = null,
  stage = "input",
  endpoint,
}: {
  supabase: SupabaseClient;
  userId: string;
  message: string;
  blocked?: boolean;
  blockReason?: string | null;
  stage?: SecurityLogStage;
  endpoint: string;
}) {
  const { error } = await supabase.from("message_logs").insert({
    user_id: userId,
    message_length: Array.from(message).length,
    message_excerpt: createExcerpt(message),
    blocked,
    block_reason: blockReason,
    stage,
    endpoint,
  });

  if (error) {
    throw new Error(`Nie udało się zapisać logu bezpieczeństwa: ${error.message}`);
  }
}

export async function recordSecurityMessageSafely(
  input: Parameters<typeof recordSecurityMessage>[0],
) {
  try {
    await recordSecurityMessage(input);
  } catch (error) {
    console.error("Security message logging failed:", error);
  }
}
