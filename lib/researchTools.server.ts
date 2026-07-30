import { tool } from "ai";
import { z } from "zod";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function calculate(expression: string) {
  if (!/^[\d\s+\-*/().,%]+$/.test(expression)) {
    throw new Error("Dozwolone są tylko liczby i operatory matematyczne.");
  }

  const normalized = expression.replace(/,/g, ".").replace(/%/g, "/100");
  const result = Function(`"use strict"; return (${normalized});`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Nie udało się obliczyć wyrażenia.");
  }

  return result;
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    normalized.startsWith("127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

function getSafeWebUrl(value: string) {
  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol) || isPrivateHostname(url.hostname)) {
    throw new Error("Dozwolone są wyłącznie publiczne adresy HTTP i HTTPS.");
  }

  return url;
}

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "AgentAI-Research/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const calculatorTool = tool({
  description:
    "Wykonuje bezpieczne obliczenia matematyczne potrzebne do porównań, procentów i zmian wartości.",
  inputSchema: z.object({
    expression: z
      .string()
      .min(1)
      .max(200)
      .describe("Wyrażenie matematyczne, np. (125 - 100) / 100 * 100"),
  }),
  execute: async ({ expression }) => {
    try {
      return {
        expression,
        result: calculate(expression),
        source: "Wbudowany kalkulator",
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Błąd obliczenia.",
        expression,
      };
    }
  },
});

export const searchWikipediaTool = tool({
  description:
    "Wyszukuje artykuły w polskiej lub angielskiej Wikipedii. Używaj do definicji, historii i kontekstu.",
  inputSchema: z.object({
    language: z.enum(["pl", "en"]).default("pl"),
    query: z.string().trim().min(2).max(160),
  }),
  execute: async ({ language, query }) => {
    try {
      type WikipediaResponse = {
        pages?: Array<{
          description?: string;
          excerpt?: string;
          key: string;
          title: string;
        }>;
      };
      const data = await fetchJson<WikipediaResponse>(
        `https://${language}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(
          query,
        )}&limit=5`,
      );

      return {
        language,
        query,
        results:
          data.pages?.map((page) => ({
            description: stripHtml(page.description ?? ""),
            excerpt: stripHtml(page.excerpt ?? ""),
            title: page.title,
            url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(
              page.key,
            )}`,
          })) ?? [],
        source: "Wikipedia REST API",
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się przeszukać Wikipedii.",
        language,
        query,
        results: [],
        source: "Wikipedia REST API",
      };
    }
  },
});

export const readWebPageTool = tool({
  description:
    "Czyta publiczną stronę internetową. Używaj do weryfikacji danych na oficjalnych stronach i w raportach branżowych.",
  inputSchema: z.object({
    url: z.string().url().max(2_000),
  }),
  execute: async ({ url: urlValue }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7_000);

    try {
      const url = getSafeWebUrl(urlValue);
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "AgentAI-Research/1.0",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Strona zwróciła HTTP ${response.status}.`);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        throw new Error("Strona nie zawiera obsługiwanego tekstu HTML.");
      }

      const text = stripHtml(await response.text()).slice(0, 6_000);

      return {
        length: text.length,
        source: url.toString(),
        text,
        url: url.toString(),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się przeczytać strony.",
        url: urlValue,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});
