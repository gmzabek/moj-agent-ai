const MAX_INPUT_LENGTH = 2_000;
const MAX_EXTERNAL_CONTENT_LENGTH = 500_000;
const DEFAULT_LIMIT = 50;
const ONE_HOUR_MS = 60 * 60 * 1_000;

export const BLOCKED_INPUT_MESSAGE =
  "Ta wiadomość została zablokowana z powodów bezpieczeństwa.";

export const BLOCKED_OUTPUT_MESSAGE =
  "Przepraszam, nie mogę udostępnić tych informacji.";

export const FIRST_SECURITY_BLOCK_MESSAGE =
  "Agent jest chwilowo niedostępny. Spróbuj ponownie za chwilę.";

export const REPEATED_SECURITY_BLOCK_MESSAGE =
  "To zapytanie pozostanie bez odpowiedzi, ponieważ narusza zasady bezpieczeństwa.";

export const COST_LIMIT_MESSAGE =
  "Zakres operacji jest zbyt duży. Ogranicz liczbę elementów i spróbuj ponownie.";

const INPUT_BLACKLIST = [
  "ignore previous",
  "system prompt",
  "ignore instructions",
  "reveal",
  "show me your",
  "translate your prompt",
];

const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/gu;
const BIDIRECTIONAL_CONTROL_CHARACTERS =
  /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;
const CONTROL_CHARACTERS = /\p{Cc}/gu;

const HOMOGLYPH_MAP = new Map([
  ["а", "a"],
  ["е", "e"],
  ["і", "i"],
  ["о", "o"],
  ["р", "p"],
  ["с", "c"],
  ["х", "x"],
  ["у", "y"],
]);

const CONTROL_INTENT_PATTERNS = [
  /\b(?:ignore|disregard|override|forget|bypass|disable)\b.{0,90}\b(?:previous|prior|system|developer|security|instructions?|rules?|filters?)\b/iu,
  /\b(?:zignoruj|pomiń|nadpisz|obejdź|wyłącz|zmień)\b.{0,90}\b(?:instrukcj\w*|zasad\w*|filtr\w*|zabezpiecze\w*|system\w*|ustawien\w*)\b/iu,
  /\b(?:system|developer|security)\s*(?:prompt|instructions?|settings?|configuration|rules?)\b/iu,
  /\b(?:prompt|instrukcj\w*|zasad\w*)\s*(?:systemow\w*|dewelopersk\w*|bezpieczeństwa)\b/iu,
  /\b(?:pokaż|ujawnij|wypisz|przetłumacz|powtórz|sparafrazuj|odtwórz)\b.{0,120}\b(?:prompt\w*|instrukcj\w*|ustawien\w*|konfiguracj\w*|kod\w*\s+źródłow\w*)\b/iu,
  /\b(?:show|reveal|print|translate|repeat|paraphrase|reconstruct)\b.{0,120}\b(?:prompt|instructions?|settings?|configuration|source\s+code)\b/iu,
  /\b(?:debuguj\w*|debugging|diagnostyk\w*)\b.{0,120}\b(?:pełn\w*\s+prompt|instrukcj\w*|konfiguracj\w*|ustawien\w*)\b/iu,
  /\b(?:pokaż|ujawnij|wypisz|podaj|show|reveal|print|list)\b.{0,120}\b(?:klucz\w*|sekr\w*|token\w*|hasł\w*|password\w*|zmienn\w*\s+środowiskow\w*)\b/iu,
  /\b(?:kod\w*\s+źródłow\w*|source\s+code)\b.{0,100}\b(?:agent\w*|backend\w*|aplikacj\w*|system\w*)\b/iu,
  /\b(?:terminal|shell|environment variables?|zmienn\w* środowiskow\w*|service role|api[\s_-]*key)\b.{0,100}\b(?:pokaż|ujawnij|show|reveal|list|wypisz|access|dostęp)\b/iu,
  /\b(?:rozmow\w*|profil\w*|dokument\w*|user[_\s-]*id)\b.{0,100}\b(?:innych|pozostałych|wszystkich|other|all)\b.{0,60}\b(?:użytkownik\w*|users?)\b/iu,
  /\b(?:wszystk\w*|innych|inne|pozostałych|all|other)\b.{0,80}\b(?:users?|użytkownik\w*|user[_\s-]*id|user[_\s-]*profiles|conversations?)\b/iu,
  /\b(?:wrzuć|dodaj|zapisz|wprowadź|zaimportuj|upload|insert|upsert|store)\b.{0,120}\b(?:rag|baz\w*\s+wiedzy|knowledge\s+base|documents?|embedding\w*)\b/iu,
  /\b(?:udawaj|pretend|act as)\b.{0,80}\b(?:administrator|developer|programista|system|root)\b/iu,
];

const SYNTAX_INJECTION_PATTERNS = [
  /<\/?(?:system|assistant|developer|tool|instructions?)\b[^>]*>/iu,
  /\[\/?(?:system|assistant|developer|tool|instructions?)\]/iu,
  /["']?(?:role|rola)["']?\s*[:=]\s*["']?(?:system|developer|assistant|tool)\b/iu,
  /\{\{[\s\S]{0,240}\b(?:system|developer|instruction|prompt|tool)\b[\s\S]{0,240}\}\}/iu,
  /(?:^|\s)(?:BEGIN|START)\s+(?:SYSTEM|DEVELOPER|INSTRUCTIONS?)\b/iu,
];

const COST_ABUSE_PATTERNS = [
  /\b(?:100|setk\w*|każd\w*|wszystk\w*|all|every)\b.{0,100}\b(?:miast\w*|kraj\w*|countries|cities|wyszuk\w*|search\w*|pogod\w*|weather)\b/iu,
  /\b(?:bez końca|w kółko|nieskończon\w*|unlimited|forever|repeat indefinitely)\b/iu,
];

const HIDDEN_STYLE_PATTERN =
  /(?:\bhidden\b|type\s*=\s*["']?hidden|aria-hidden\s*=\s*["']?true|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|font-size\s*:\s*(?:0|1px)|width\s*:\s*0\s*;?\s*height\s*:\s*0|(?:left|top)\s*:\s*-\d{3,}(?:px|rem)|clip(?:-path)?\s*:\s*(?:rect\s*\(0|inset\s*\(100%))/iu;

const SAME_FOREGROUND_BACKGROUND_PATTERN =
  /(?:color\s*:\s*(?:white|#fff(?:fff)?)[^"']*background(?:-color)?\s*:\s*(?:white|#fff(?:fff)?)|background(?:-color)?\s*:\s*(?:white|#fff(?:fff)?)[^"']*color\s*:\s*(?:white|#fff(?:fff)?)|color\s*:\s*(?:black|#000(?:000)?)[^"']*background(?:-color)?\s*:\s*(?:black|#000(?:000)?)|background(?:-color)?\s*:\s*(?:black|#000(?:000)?)[^"']*color\s*:\s*(?:black|#000(?:000)?))/iu;

const SENSITIVE_OUTPUT_PATTERNS = [
  /\bapi[\s_-]*key\b/iu,
  /\bsupabase[\s_-]*url\b/iu,
  /\bsystem[\s_-]*prompt\b/iu,
  /\b(?:developer[\s_-]*instructions?|security[\s_-]*(?:settings?|rules?|configuration))\b/iu,
  /\b(?:user[\s_-]*profiles|message[\s_-]*logs|service[\s_-]*role)\b/iu,
  /\b(?:source\s+code|kod\s+źródłowy)\b.{0,80}\b(?:agent\w*|backend\w*|aplikacj\w*|system\w*)\b/iu,
  /\b(?:password|hasło|secret|sekret|token|cookie|authorization)\s*[:=]\s*\S+/iu,
  /\bbearer\s+[a-z0-9._~+/=-]{12,}\b/iu,
  /\b(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/iu,
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
    .replace(BIDIRECTIONAL_CONTROL_CHARACTERS, "")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/[аеіорсху]/giu, (character) =>
      HOMOGLYPH_MAP.get(character.toLocaleLowerCase("en-US")) ?? character,
    )
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function decodeEscapedCharacters(value) {
  return value
    .replace(/\\u\{([0-9a-f]{1,6})\}/giu, (match, code) => {
      const codePoint = Number.parseInt(code, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/\\u([0-9a-f]{4})/giu, (match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/\\x([0-9a-f]{2})/giu, (match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function decodeBasicHtmlEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (match, entity) => {
    const normalized = entity.toLocaleLowerCase("en-US");

    if (normalized in named) return named[normalized];

    const radix = normalized.startsWith("#x") ? 16 : 10;
    const numeric = normalized.replace(/^#x?/u, "");
    const codePoint = Number.parseInt(numeric, radix);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
  });
}

function decodeBase64Fragments(value) {
  if (typeof globalThis.atob !== "function") return [];

  return (value.match(/[a-z0-9+/]{20,}={0,2}/giu) ?? [])
    .slice(0, 4)
    .flatMap((candidate) => {
      try {
        const decoded = globalThis.atob(candidate);
        const printable = Array.from(decoded).filter((character) =>
          /[\p{L}\p{N}\p{P}\p{Zs}]/u.test(character),
        ).length;
        return printable / Math.max(1, decoded.length) >= 0.8 ? [decoded] : [];
      } catch {
        return [];
      }
    });
}

function createInspectionVariants(value) {
  const variants = new Set([value, decodeEscapedCharacters(value), decodeBasicHtmlEntities(value)]);

  if (/%[0-9a-f]{2}/iu.test(value)) {
    try {
      variants.add(decodeURIComponent(value));
    } catch {
      // Niepoprawne kodowanie URL pozostaje w wariancie bazowym.
    }
  }

  for (const decoded of decodeBase64Fragments(value)) variants.add(decoded);

  return Array.from(variants, normalizeForInspection);
}

function findThreatReason(value) {
  const variants = createInspectionVariants(value);

  if (variants.some((variant) => SYNTAX_INJECTION_PATTERNS.some((pattern) => pattern.test(variant)))) {
    return "syntax_injection";
  }

  if (variants.some((variant) => INPUT_BLACKLIST.some((phrase) => variant.includes(phrase)))) {
    return "blocked_phrase";
  }

  if (variants.some((variant) => CONTROL_INTENT_PATTERNS.some((pattern) => pattern.test(variant)))) {
    return "control_attempt";
  }

  return null;
}

function containsCostAbuse(value) {
  return createInspectionVariants(value).some((variant) =>
    COST_ABUSE_PATTERNS.some((pattern) => pattern.test(variant)),
  );
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
    .replace(BIDIRECTIONAL_CONTROL_CHARACTERS, "")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
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
  const threatReason = findThreatReason(input);

  if (threatReason) {
    return {
      ok: false,
      reason: threatReason,
      message: BLOCKED_INPUT_MESSAGE,
    };
  }

  if (containsCostAbuse(input)) {
    return {
      ok: false,
      reason: "cost_abuse",
      message: COST_LIMIT_MESSAGE,
    };
  }

  return { ok: true, value: sanitized };
}

export function validateExternalContent(input) {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, reason: "invalid_external_content" };
  }

  if (countCharacters(input) > MAX_EXTERNAL_CONTENT_LENGTH) {
    return { ok: false, reason: "external_content_too_long" };
  }

  const threatReason = findThreatReason(input);
  if (threatReason) return { ok: false, reason: "indirect_injection" };

  return { ok: true, value: sanitizeInput(input) };
}

export function sanitizeHtmlForAgent(html) {
  if (typeof html !== "string" || html.trim() === "") {
    return { ok: false, reason: "invalid_external_content" };
  }

  const inherentlyHiddenBlocks =
    html.match(
      /<(?:script|style|template|noscript|svg)\b[\s\S]*?<\/(?:script|style|template|noscript|svg)\s*>/giu,
    ) ?? [];
  let dangerousHiddenContent = inherentlyHiddenBlocks.some((block) =>
    Boolean(findThreatReason(block)),
  );
  const withoutHiddenElements = html.replace(
    /<([a-z][\w:-]*)\b([^>]*(?:\bhidden\b|aria-hidden\s*=\s*["']?true|display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:|(?:width|height|left|top)\s*:|clip(?:-path)?\s*:|color\s*:|background(?:-color)?\s*:)[^>]*)>([\s\S]*?)<\/\1\s*>/giu,
    (fullMatch, _tagName, attributes = "", innerContent = "") => {
      if (
        !HIDDEN_STYLE_PATTERN.test(attributes) &&
        !SAME_FOREGROUND_BACKGROUND_PATTERN.test(attributes)
      ) {
        return fullMatch;
      }
      if (findThreatReason(innerContent)) dangerousHiddenContent = true;
      return " ";
    },
  );

  const comments = withoutHiddenElements.match(/<!--[\s\S]*?-->/gu) ?? [];
  if (comments.some((comment) => findThreatReason(comment))) {
    dangerousHiddenContent = true;
  }

  if (dangerousHiddenContent) {
    return { ok: false, reason: "hidden_content" };
  }

  const visibleText = decodeBasicHtmlEntities(
    withoutHiddenElements
      .replace(/<(?:script|style|template|noscript|svg)\b[\s\S]*?<\/(?:script|style|template|noscript|svg)\s*>/giu, " ")
      .replace(/<!--[\s\S]*?-->/gu, " ")
      .replace(/<[^>]+>/gu, " ")
      .replace(/\s+/gu, " ")
      .trim(),
  );

  return validateExternalContent(visibleText);
}

export function isSecurityViolationReason(reason) {
  return [
    "blocked_phrase",
    "control_attempt",
    "syntax_injection",
    "too_long",
    "indirect_injection",
    "hidden_content",
  ].includes(reason);
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
