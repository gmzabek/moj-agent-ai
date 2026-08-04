import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIRST_SECURITY_BLOCK_MESSAGE,
  REPEATED_SECURITY_BLOCK_MESSAGE,
} from "../security.mjs";

export type SecurityLogStage = "input" | "output" | "rate_limit";

const VIOLATION_WINDOW_MS = 60 * 60 * 1_000;
const localViolations = new Map<string, number[]>();

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

export async function registerSecurityViolation({
  supabase,
  userId,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  userId: string;
  now?: Date;
}) {
  const cutoff = now.getTime() - VIOLATION_WINDOW_MS;
  const recentLocal = (localViolations.get(userId) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );
  const { count, error } = await supabase
    .from("message_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("blocked", true)
    .gte("created_at", new Date(cutoff).toISOString());

  const isRepeated = recentLocal.length > 0 || (!error && (count ?? 0) > 0);
  recentLocal.push(now.getTime());
  localViolations.set(userId, recentLocal);

  return {
    isRepeated,
    message: isRepeated
      ? REPEATED_SECURITY_BLOCK_MESSAGE
      : FIRST_SECURITY_BLOCK_MESSAGE,
  };
}

export async function recordSecurityViolationAndGetMessage({
  supabase,
  userId,
  message,
  reason,
  stage = "input",
  endpoint,
}: {
  supabase: SupabaseClient;
  userId: string;
  message: string;
  reason: string;
  stage?: SecurityLogStage;
  endpoint: string;
}) {
  const violation = await registerSecurityViolation({ supabase, userId });
  await recordSecurityMessageSafely({
    supabase,
    userId,
    message,
    blocked: true,
    blockReason: reason,
    stage,
    endpoint,
  });

  return violation.message;
}
