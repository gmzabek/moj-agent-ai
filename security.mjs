const MAX_INPUT_LENGTH = 2_000;
const DEFAULT_LIMIT = 50;
const ONE_HOUR_MS = 60 * 60 * 1_000;

export const BLOCKED_INPUT_MESSAGE =
  "Ta wiadomość została zablokowana z powodów bezpieczeństwa.";

export const BLOCKED_OUTPUT_MESSAGE =
  "Przepraszam, nie mogę udostępnić tych informacji.";

const INPUT_BLACKLIST = [
  "ignore previous",
  "system prompt",
  "ignore instructions",
  "reveal",
  "show me your",
  "translate your prompt",
];

const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/gu;
const CONTROL_CHARACTERS = /\p{Cc}/gu;

const SENSITIVE_OUTPUT_PATTERNS = [
  /\bapi[\s_-]*key\b/iu,
  /\bsupabase[\s_-]*url\b/iu,
  /\bsystem[\s_-]*prompt\b/iu,
  /\b(?:user[\s_-]*profiles|message[\s_-]*logs)\b/iu,
  /\bsk-[a-z0-9_-]{16,}\b/iu,
  /\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/iu,
];

function countCharacters(value) {
  return Array.from(value).length;
}

function normalizeForInspection(value) {
  return value
    .normalize("NFKC")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

/**
 * Usuwa znaki kontrolne i zero-width. Znak kontrolny jest zastępowany spacją,
 * żeby usunięcie go nie skleiło dwóch słów i nie zmieniło znaczenia tekstu.
 */
export function sanitizeInput(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(CONTROL_CHARACTERS, " ")
    .trim();
}

/**
 * Waliduje wiadomość przed przekazaniem jej do modelu.
 */
export function validateInput(input) {
  if (typeof input !== "string" || input.trim() === "") {
    return {
      ok: false,
      reason: "invalid_type_or_empty",
      message: BLOCKED_INPUT_MESSAGE,
    };
  }

  // Sprawdzamy wejście także przed sanityzacją, aby tysiące niewidocznych
  // znaków nie pozwalały ominąć limitu rozmiaru requestu.
  if (countCharacters(input) > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: BLOCKED_INPUT_MESSAGE,
    };
  }

  const sanitized = sanitizeInput(input);
  const inspected = normalizeForInspection(sanitized);
  const matchedPhrase = INPUT_BLACKLIST.find((phrase) =>
    inspected.includes(phrase),
  );

  if (matchedPhrase) {
    return {
      ok: false,
      reason: "blocked_phrase",
      message: BLOCKED_INPUT_MESSAGE,
    };
  }

  return { ok: true, value: sanitized };
}

/**
 * Filtruje odpowiedź modelu. protectedFragments powinny zawierać charakterystyczne
 * fragmenty instrukcji systemowej, nigdy dane pochodzące od użytkownika.
 */
export function filterOutput(output, { protectedFragments = [] } = {}) {
  if (typeof output !== "string") {
    return BLOCKED_OUTPUT_MESSAGE;
  }

  const inspected = normalizeForInspection(output);
  const containsSensitivePattern = SENSITIVE_OUTPUT_PATTERNS.some((pattern) =>
    pattern.test(output),
  );
  const containsProtectedFragment = protectedFragments
    .filter((fragment) => typeof fragment === "string")
    .map(normalizeForInspection)
    .filter((fragment) => fragment.length >= 8)
    .some((fragment) => inspected.includes(fragment));

  if (containsSensitivePattern || containsProtectedFragment) {
    return BLOCKED_OUTPUT_MESSAGE;
  }

  return output;
}

/**
 * Przesuwne okno czasowe trzymane w pamięci procesu.
 *
 * W środowisku serverless lub przy wielu instancjach należy zastąpić ten magazyn
 * współdzielonym backendem (np. Supabase/Redis), zachowując ten sam interfejs.
 */
export class SlidingWindowRateLimiter {
  #requests = new Map();

  constructor({ limit = DEFAULT_LIMIT, windowMs = ONE_HOUR_MS } = {}) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new TypeError("limit must be a positive integer");
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new TypeError("windowMs must be a positive number");
    }

    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(userId, now = Date.now()) {
    if (typeof userId !== "string" || userId.trim() === "") {
      throw new TypeError(
        "userId must come from an authenticated server-side session",
      );
    }

    const cutoff = now - this.windowMs;
    const recent = (this.#requests.get(userId) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (recent.length >= this.limit) {
      const retryAfterMs = Math.max(1, recent[0] + this.windowMs - now);
      const retryAfterMinutes = Math.max(
        1,
        Math.ceil(retryAfterMs / 60_000),
      );
      this.#requests.set(userId, recent);

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        retryAfterMinutes,
        message:
          `Osiągnąłeś limit wiadomości (${this.limit}/h). ` +
          `Spróbuj za ${retryAfterMinutes} min.`,
      };
    }

    recent.push(now);
    this.#requests.set(userId, recent);

    return {
      allowed: true,
      remaining: this.limit - recent.length,
      retryAfterMs: 0,
      retryAfterMinutes: 0,
    };
  }

  clear(userId) {
    this.#requests.delete(userId);
  }
}

export const messageRateLimiter = new SlidingWindowRateLimiter();

/**
 * Kompletny przepływ ochronny wokół funkcji wywołującej LLM.
 */
export async function runProtectedChat({
  userId,
  input,
  generate,
  protectedFragments = [],
  rateLimiter = messageRateLimiter,
  now,
}) {
  if (typeof generate !== "function") {
    throw new TypeError("generate must be a function");
  }

  const rateLimit = rateLimiter.check(userId, now);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      status: 429,
      error: "rate_limit_exceeded",
      message: rateLimit.message,
      retryAfterMs: rateLimit.retryAfterMs,
    };
  }

  const validation = validateInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: validation.reason,
      message: validation.message,
    };
  }

  const rawOutput = await generate(validation.value);
  const output = filterOutput(rawOutput, { protectedFragments });

  return {
    ok: true,
    status: 200,
    output,
    filtered: output === BLOCKED_OUTPUT_MESSAGE,
    remaining: rateLimit.remaining,
  };
}
