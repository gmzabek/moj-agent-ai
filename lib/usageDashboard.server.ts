import { createClient } from "@supabase/supabase-js";

const TIME_ZONE = "Europe/Warsaw";
const PAGE_SIZE = 1_000;
const MAX_ROWS = 100_000;

type UsageRow = {
  created_at: string;
  endpoint: string;
  tokens_input: number | string;
  tokens_output: number | string;
};

type ConversationTrendRow = {
  created_at: string;
};

type RecentConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  updated_at: string;
  messages: Array<{ count: number | string }> | null;
};

type DashboardInput = {
  now: Date;
  totalConversations: number;
  conversationUserIds: string[];
  conversationTrendRows: ConversationTrendRow[];
  usageRows: UsageRow[];
  recentConversationRows: RecentConversationRow[];
  emailByUserId: Map<string, string>;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getDayLabel(value: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIME_ZONE,
    weekday: "short",
  })
    .format(value)
    .replace(",", "");
}

function getLastSevenDays(now: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86_400_000);
    return { date: getDateKey(date), label: getDayLabel(date) };
  });
}

function normalizeEndpoint(endpoint: string) {
  if (endpoint.startsWith("/api/chat")) return "/chat";
  if (endpoint.startsWith("/api/react")) return "/react";
  if (endpoint.startsWith("/api/report")) return "/report";
  if (endpoint.startsWith("/api/email-triage")) return "/email-triage";
  return "Inne";
}

function getConfiguredPrice(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getSupabaseAdmin() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  )?.trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  )?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function aggregateUsageDashboard(input: DashboardInput) {
  const days = getLastSevenDays(input.now);
  const dayKeys = new Set(days.map((day) => day.date));
  const todayKey = getDateKey(input.now);
  const daily = days.map((day) => ({ ...day, conversations: 0, tokens: 0 }));
  const dailyByKey = new Map(daily.map((day) => [day.date, day]));
  const endpointTokens = new Map<string, number>([
    ["/chat", 0],
    ["/react", 0],
    ["/report", 0],
    ["/email-triage", 0],
    ["Inne", 0],
  ]);
  let tokensInputToday = 0;
  let tokensOutputToday = 0;

  for (const row of input.conversationTrendRows) {
    const key = getDateKey(new Date(row.created_at));
    const target = dailyByKey.get(key);
    if (target) target.conversations += 1;
  }

  for (const row of input.usageRows) {
    const key = getDateKey(new Date(row.created_at));
    if (!dayKeys.has(key)) continue;

    const tokensInput = toNumber(row.tokens_input);
    const tokensOutput = toNumber(row.tokens_output);
    const tokens = tokensInput + tokensOutput;
    const target = dailyByKey.get(key);
    if (target) target.tokens += tokens;

    const endpoint = normalizeEndpoint(row.endpoint);
    endpointTokens.set(endpoint, (endpointTokens.get(endpoint) ?? 0) + tokens);

    if (key === todayKey) {
      tokensInputToday += tokensInput;
      tokensOutputToday += tokensOutput;
    }
  }

  const totalEndpointTokens = Array.from(endpointTokens.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const endpointColors: Record<string, string> = {
    "/chat": "#8cf0b5",
    "/react": "#8fb8ff",
    "/report": "#c6a7ff",
    "/email-triage": "#f5bd72",
    Inne: "#6f788c",
  };
  const endpoints = Array.from(endpointTokens.entries())
    .map(([endpoint, tokens]) => ({
      endpoint,
      tokens,
      percentage: totalEndpointTokens
        ? Math.round((tokens / totalEndpointTokens) * 100)
        : 0,
      color: endpointColors[endpoint],
    }))
    .filter((entry) => entry.endpoint !== "Inne" || entry.tokens > 0);
  const costToday =
    (tokensInputToday / 1_000_000) * input.inputPricePerMillion +
    (tokensOutputToday / 1_000_000) * input.outputPricePerMillion;

  return {
    generatedAt: input.now.toISOString(),
    pricing: {
      currency: "USD" as const,
      inputPerMillion: input.inputPricePerMillion,
      outputPerMillion: input.outputPricePerMillion,
    },
    stats: {
      users: new Set(input.conversationUserIds).size,
      conversations: input.totalConversations,
      tokensToday: Math.round(tokensInputToday + tokensOutputToday),
      costToday,
    },
    daily: daily.map((day) => ({
      ...day,
      conversations: Math.round(day.conversations),
      tokens: Math.round(day.tokens),
    })),
    endpoints,
    recentConversations: input.recentConversationRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email:
        input.emailByUserId.get(row.user_id) ??
        `Użytkownik ${row.user_id.slice(0, 8)}`,
      title: row.title?.trim() || "Nowa rozmowa",
      updatedAt: row.updated_at,
      messageCount: Math.round(toNumber(row.messages?.[0]?.count)),
    })),
  };
}

async function getEmailMap(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userIds: string[],
) {
  const entries = await Promise.all(
    Array.from(new Set(userIds)).map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      return [userId, error ? null : (data.user.email ?? null)] as const;
    }),
  );

  return new Map(
    entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
}

export async function getUsageDashboardData() {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const queryStart = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const conversationUserIds: string[] = [];
  const conversationTrendRows: ConversationTrendRow[] = [];
  const usageRows: UsageRow[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("conversations")
      .select("user_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Nie udało się pobrać użytkowników: ${error.message}`);
    const rows = (data ?? []) as Array<{ user_id: string }>;
    conversationUserIds.push(...rows.map((row) => row.user_id));
    if (rows.length < PAGE_SIZE) break;
  }

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("conversations")
      .select("created_at")
      .gte("created_at", queryStart)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Nie udało się pobrać trendu rozmów: ${error.message}`);
    const rows = (data ?? []) as ConversationTrendRow[];
    conversationTrendRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("api_usage")
      .select("created_at, endpoint, tokens_input, tokens_output")
      .gte("created_at", queryStart)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Nie udało się pobrać użycia API: ${error.message}`);
    const rows = (data ?? []) as UsageRow[];
    usageRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const [countResult, recentResult] = await Promise.all([
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin
      .from("conversations")
      .select("id, user_id, title, updated_at, messages(count)")
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);
  const firstError = countResult.error ?? recentResult.error;
  if (firstError) {
    throw new Error(`Nie udało się pobrać rozmów: ${firstError.message}`);
  }

  const recentConversationRows =
    (recentResult.data ?? []) as unknown as RecentConversationRow[];
  const emailByUserId = await getEmailMap(
    admin,
    recentConversationRows.map((row) => row.user_id),
  );

  return aggregateUsageDashboard({
    now,
    totalConversations: countResult.count ?? 0,
    conversationUserIds,
    conversationTrendRows,
    usageRows,
    recentConversationRows,
    emailByUserId,
    inputPricePerMillion: getConfiguredPrice(
      "DASHBOARD_INPUT_COST_PER_MILLION",
      0.15,
    ),
    outputPricePerMillion: getConfiguredPrice(
      "DASHBOARD_OUTPUT_COST_PER_MILLION",
      0.6,
    ),
  });
}

export type UsageDashboardData = Awaited<
  ReturnType<typeof getUsageDashboardData>
>;
