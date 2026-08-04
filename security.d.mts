export const BLOCKED_INPUT_MESSAGE: string;
export const BLOCKED_OUTPUT_MESSAGE: string;
export const FIRST_SECURITY_BLOCK_MESSAGE: string;
export const REPEATED_SECURITY_BLOCK_MESSAGE: string;
export const COST_LIMIT_MESSAGE: string;

export type InputValidationResult =
  | { ok: true; value: string }
  | {
      ok: false;
      reason:
        | "invalid_type_or_empty"
        | "too_long"
        | "blocked_phrase"
        | "control_attempt"
        | "syntax_injection"
        | "cost_abuse";
      message: string;
    };

export type ExternalContentValidationResult =
  | { ok: true; value: string }
  | {
      ok: false;
      reason:
        | "invalid_external_content"
        | "external_content_too_long"
        | "indirect_injection"
        | "hidden_content";
    };

export function sanitizeInput(input: unknown): string;
export function validateInput(input: unknown): InputValidationResult;
export function validateExternalContent(
  input: unknown,
): ExternalContentValidationResult;
export function sanitizeHtmlForAgent(
  html: unknown,
): ExternalContentValidationResult;
export function isSecurityViolationReason(reason: string): boolean;
export function filterOutput(
  output: unknown,
  options?: { protectedFragments?: string[] },
): string;

export type RateLimitResult =
  | {
      allowed: true;
      remaining: number;
      retryAfterMs: 0;
      retryAfterMinutes: 0;
    }
  | {
      allowed: false;
      remaining: 0;
      retryAfterMs: number;
      retryAfterMinutes: number;
      message: string;
    };

export class SlidingWindowRateLimiter {
  constructor(options?: { limit?: number; windowMs?: number });
  readonly limit: number;
  readonly windowMs: number;
  check(userId: string, now?: number): RateLimitResult;
  clear(userId: string): void;
}

export const messageRateLimiter: SlidingWindowRateLimiter;

export function runProtectedChat(options: {
  userId: string;
  input: unknown;
  generate: (safeInput: string) => string | Promise<string>;
  protectedFragments?: string[];
  rateLimiter?: SlidingWindowRateLimiter;
  now?: number;
}): Promise<
  | {
      ok: false;
      status: 400 | 429;
      error: string;
      message: string;
      retryAfterMs?: number;
    }
  | {
      ok: true;
      status: 200;
      output: string;
      filtered: boolean;
      remaining: number;
    }
>;
