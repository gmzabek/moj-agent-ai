import assert from "node:assert/strict";
import test from "node:test";
import { aggregateUsageDashboard } from "./usageDashboard.server.ts";

test("agreguje KPI, trendy, endpointy i ostatnie rozmowy", () => {
  const result = aggregateUsageDashboard({
    now: new Date("2026-08-06T12:00:00.000Z"),
    totalConversations: 4,
    conversationUserIds: ["user-1", "user-1", "user-2", "user-3"],
    conversationTrendRows: [
      { created_at: "2026-08-06T08:00:00.000Z" },
      { created_at: "2026-08-05T08:00:00.000Z" },
      { created_at: "2026-08-05T09:00:00.000Z" },
    ],
    usageRows: [
      {
        created_at: "2026-08-06T08:00:00.000Z",
        endpoint: "/api/chat",
        tokens_input: 1_000,
        tokens_output: 500,
      },
      {
        created_at: "2026-08-05T08:00:00.000Z",
        endpoint: "/api/react",
        tokens_input: 1_250,
        tokens_output: 750,
      },
      {
        created_at: "2026-07-20T08:00:00.000Z",
        endpoint: "/api/report",
        tokens_input: 99_999,
        tokens_output: 0,
      },
    ],
    recentConversationRows: [
      {
        id: "conversation-1",
        user_id: "user-1",
        title: "Plan automatyzacji",
        updated_at: "2026-08-06T09:00:00.000Z",
        messages: [{ count: "6" }],
      },
    ],
    emailByUserId: new Map([["user-1", "leo@example.com"]]),
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
  });

  assert.deepEqual(result.stats, {
    users: 3,
    conversations: 4,
    tokensToday: 1_500,
    costToday: 0.00045,
  });
  assert.equal(result.daily.at(-1).date, "2026-08-06");
  assert.equal(result.daily.at(-1).tokens, 1_500);
  assert.equal(result.daily.at(-1).conversations, 1);
  assert.equal(result.daily.at(-2).tokens, 2_000);
  assert.equal(result.daily.at(-2).conversations, 2);
  assert.equal(result.endpoints.find((entry) => entry.endpoint === "/chat").percentage, 43);
  assert.equal(result.endpoints.find((entry) => entry.endpoint === "/react").percentage, 57);
  assert.deepEqual(result.recentConversations[0], {
    id: "conversation-1",
    userId: "user-1",
    email: "leo@example.com",
    title: "Plan automatyzacji",
    updatedAt: "2026-08-06T09:00:00.000Z",
    messageCount: 6,
  });
});

test("zwraca bezpieczne zera, gdy nie ma danych", () => {
  const result = aggregateUsageDashboard({
    now: new Date("2026-08-06T12:00:00.000Z"),
    totalConversations: 0,
    conversationUserIds: [],
    conversationTrendRows: [],
    usageRows: [],
    recentConversationRows: [],
    emailByUserId: new Map(),
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
  });

  assert.equal(result.stats.tokensToday, 0);
  assert.equal(result.stats.costToday, 0);
  assert.equal(result.daily.length, 7);
  assert.ok(result.endpoints.every((entry) => entry.tokens === 0));
});
