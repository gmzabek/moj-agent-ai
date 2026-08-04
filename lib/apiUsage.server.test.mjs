import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_TOKEN_LIMIT_MESSAGE,
  DEFAULT_DAILY_TOKEN_LIMIT,
  enforceDailyTokenBudget,
  normalizeTokenUsage,
  recordApiUsage,
} from "./apiUsage.server.ts";

test("domyślny limit wynosi 20k tokenów", () => {
  assert.equal(DEFAULT_DAILY_TOKEN_LIMIT, 20_000);
});

test("normalizuje usage z Vercel AI SDK", () => {
  assert.deepEqual(
    normalizeTokenUsage({ inputTokens: 120, outputTokens: 45 }),
    { tokensInput: 120, tokensOutput: 45 },
  );
});

test("normalizuje usageMetadata z Google GenAI", () => {
  assert.deepEqual(
    normalizeTokenUsage({
      promptTokenCount: 80,
      candidatesTokenCount: 20,
    }),
    { tokensInput: 80, tokensOutput: 20 },
  );
});

test("brakujące i nieprawidłowe liczniki zamienia na zero", () => {
  assert.deepEqual(
    normalizeTokenUsage({
      inputTokens: Number.NaN,
      outputTokens: -10,
    }),
    { tokensInput: 0, tokensOutput: 0 },
  );
});

test("blokuje kolejne wywołanie po wykorzystaniu 20k tokenów", async () => {
  const supabase = {
    rpc: async () => ({ data: "20000", error: null }),
  };

  const response = await enforceDailyTokenBudget(supabase);

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: DAILY_TOKEN_LIMIT_MESSAGE,
  });
});

test("dopuszcza wywołanie poniżej dziennego limitu", async () => {
  const supabase = {
    rpc: async () => ({ data: 19_999, error: null }),
  };

  assert.equal(await enforceDailyTokenBudget(supabase), null);
});

test("zapisuje znormalizowane zużycie z userem, modelem i endpointem", async () => {
  let inserted;
  const supabase = {
    from: (table) => {
      assert.equal(table, "api_usage");
      return {
        insert: async (row) => {
          inserted = row;
          return { error: null };
        },
      };
    },
  };

  await recordApiUsage({
    supabase,
    userId: "user-1",
    usage: { inputTokens: 12.4, outputTokens: 4.6 },
    model: "test-model",
    endpoint: "/api/test",
  });

  assert.deepEqual(inserted, {
    user_id: "user-1",
    tokens_input: 12,
    tokens_output: 5,
    model: "test-model",
    endpoint: "/api/test",
  });
});
