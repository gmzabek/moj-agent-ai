export type GeminiFallbackStatus = {
  active: boolean;
  count: number;
  fallbackModel?: string;
  lastAt: string;
  lastMessage: string;
  requestedModel?: string;
  source?: string;
};

export const GEMINI_FALLBACK_EVENT = "gemini-fallback-status";
export const GEMINI_FALLBACK_STORAGE_KEY = "gemini-fallback-status";

const unavailablePatterns = [
  "gemini",
  "google ai",
  "google blokuje",
  "quota",
  "rate limit",
  "rate-limits",
  "resource_exhausted",
  "limit darmowych",
  "limit wydatków",
  "miesięczny limit",
  "przekroczył",
  "modele gemini",
];

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function isGeminiUnavailableText(text: string) {
  const normalizedText = text.toLowerCase();
  const hasLimitSignal = unavailablePatterns.some((pattern) =>
    normalizedText.includes(pattern),
  );
  const mentionsUnavailable =
    normalizedText.includes("niedostęp") ||
    normalizedText.includes("wyczerp") ||
    normalizedText.includes("odrzucił") ||
    normalizedText.includes("blokuje") ||
    normalizedText.includes("limit");

  return hasLimitSignal && mentionsUnavailable;
}

export function readGeminiFallbackStatus(): GeminiFallbackStatus | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const rawStatus = storage.getItem(GEMINI_FALLBACK_STORAGE_KEY);

  if (!rawStatus) {
    return null;
  }

  try {
    const parsedStatus = JSON.parse(rawStatus) as GeminiFallbackStatus;

    if (
      typeof parsedStatus.count === "number" &&
      typeof parsedStatus.lastMessage === "string"
    ) {
      return parsedStatus;
    }
  } catch {
    storage.removeItem(GEMINI_FALLBACK_STORAGE_KEY);
  }

  return null;
}

export function reportGeminiFallback(
  message: string,
  details: Pick<
    GeminiFallbackStatus,
    "fallbackModel" | "requestedModel" | "source"
  > = {},
) {
  const storage = getStorage();

  if (!storage || !isGeminiUnavailableText(message)) {
    return null;
  }

  const previousStatus = readGeminiFallbackStatus();
  const nextStatus: GeminiFallbackStatus = {
    active: true,
    count: (previousStatus?.count ?? 0) + 1,
    fallbackModel: details.fallbackModel,
    lastAt: new Date().toISOString(),
    lastMessage: message,
    requestedModel: details.requestedModel,
    source: details.source,
  };

  storage.setItem(GEMINI_FALLBACK_STORAGE_KEY, JSON.stringify(nextStatus));
  window.dispatchEvent(
    new CustomEvent<GeminiFallbackStatus>(GEMINI_FALLBACK_EVENT, {
      detail: nextStatus,
    }),
  );

  return nextStatus;
}

export function clearGeminiFallbackStatus() {
  const storage = getStorage();
  const currentStatus = readGeminiFallbackStatus();

  if (!storage || !currentStatus) {
    return null;
  }

  const nextStatus: GeminiFallbackStatus = {
    ...currentStatus,
    active: false,
  };

  storage.setItem(GEMINI_FALLBACK_STORAGE_KEY, JSON.stringify(nextStatus));
  window.dispatchEvent(
    new CustomEvent<GeminiFallbackStatus>(GEMINI_FALLBACK_EVENT, {
      detail: nextStatus,
    }),
  );

  return nextStatus;
}
