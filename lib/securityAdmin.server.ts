import { createClient, type User } from "@supabase/supabase-js";
import { getDailyTokenLimit } from "./apiUsage.server";

type UsageRow = {
  user_id: string;
  tokens_today: number | string;
  tokens_week: number | string;
};

type StatsRow = {
  tokens_today: number | string;
  tokens_week: number | string;
  blocked_messages: number | string;
  average_tokens_per_user: number | string;
};

type FrequencyRow = {
  user_id: string;
  messages_last_10_minutes: number | string;
};

type BlockedMessageRow = {
  id: string;
  user_id: string;
  created_at: string;
  message_excerpt: string;
  block_reason: string | null;
  stage: "input" | "output" | "rate_limit";
  endpoint: string;
};

type ViolationRow = {
  user_id: string;
  violations_last_hour: number | string;
  violations_last_24_hours: number | string;
  violations_total: number | string;
  last_violation_at: string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSecurityAdminConfigured() {
  return getAdminEmails().size > 0;
}

export function isSecurityAdmin(user: User) {
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && getAdminEmails().has(email));
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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getUserEmailMap(userIds: string[]) {
  const admin = getSupabaseAdmin();
  const uniqueIds = Array.from(new Set(userIds)).slice(0, 100);
  const entries = await Promise.all(
    uniqueIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      return [
        userId,
        error ? null : (data.user.email ?? null),
      ] as const;
    }),
  );

  return new Map(entries);
}

export async function getSecurityDashboardData() {
  const admin = getSupabaseAdmin();
  const dailyTokenLimit = getDailyTokenLimit();
  const [
    usageResult,
    statsResult,
    frequencyResult,
    blockedResult,
    violationResult,
  ] =
    await Promise.all([
      admin.rpc("security_usage_by_user"),
      admin.rpc("security_dashboard_stats"),
      admin.rpc("security_high_frequency_users"),
      admin
        .from("message_logs")
        .select(
          "id, user_id, created_at, message_excerpt, block_reason, stage, endpoint",
        )
        .eq("blocked", true)
        .order("created_at", { ascending: false })
        .limit(50),
      admin.rpc("security_violation_counts"),
    ]);

  const firstError =
    usageResult.error ??
    statsResult.error ??
    frequencyResult.error ??
    blockedResult.error;

  if (firstError) {
    throw new Error(`Nie udało się pobrać panelu bezpieczeństwa: ${firstError.message}`);
  }

  const usageRows = (usageResult.data ?? []) as UsageRow[];
  const stats = ((statsResult.data ?? [])[0] ?? {}) as Partial<StatsRow>;
  const frequencyRows = (frequencyResult.data ?? []) as FrequencyRow[];
  const blockedRows = (blockedResult.data ?? []) as BlockedMessageRow[];
  const violationRows = (violationResult.data ?? []) as ViolationRow[];
  const emailMap = await getUserEmailMap([
    ...usageRows.map((row) => row.user_id),
    ...frequencyRows.map((row) => row.user_id),
    ...blockedRows.map((row) => row.user_id),
    ...violationRows.map((row) => row.user_id),
  ]);
  const displayUser = (userId: string) =>
    emailMap.get(userId) ?? `User ${userId.slice(0, 8)}`;

  const topUsers = usageRows.map((row) => {
    const tokensToday = toNumber(row.tokens_today);
    return {
      userId: row.user_id,
      email: displayUser(row.user_id),
      tokensToday,
      tokensWeek: toNumber(row.tokens_week),
      dailyLimitPercent: Math.min(
        100,
        Math.round((tokensToday / dailyTokenLimit) * 100),
      ),
    };
  });

  const blockedMessages = blockedRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    user: displayUser(row.user_id),
    message: row.message_excerpt,
    reason: row.block_reason ?? "Nieokreślony powód",
    stage: row.stage,
    endpoint: row.endpoint,
    createdAt: row.created_at,
  }));

  const violationCounters = violationRows.map((row) => ({
    userId: row.user_id,
    user: displayUser(row.user_id),
    lastHour: toNumber(row.violations_last_hour),
    last24Hours: toNumber(row.violations_last_24_hours),
    total: toNumber(row.violations_total),
    lastViolationAt: row.last_violation_at,
  }));

  const diagnostics = [
    {
      id: "input-validation",
      name: "Walidacja wejścia",
      detail: "Długość, znaki kontrolne i niedozwolone zamiary",
      status: "active" as const,
    },
    {
      id: "obfuscation-detection",
      name: "Wykrywanie zaciemniania",
      detail: "Kodowanie URL, Base64, encje, homoglify i znaki niewidoczne",
      status: "active" as const,
    },
    {
      id: "hidden-content",
      name: "Filtr ukrytej treści",
      detail: "HTML, komentarze, opacity, display i zgodne kolory",
      status: "active" as const,
    },
    {
      id: "output-filter",
      name: "Filtr odpowiedzi",
      detail: "Blokada promptów, sekretów, konfiguracji i kodu źródłowego",
      status: "active" as const,
    },
    {
      id: "rag-boundary",
      name: "Izolacja RAG",
      detail: "Filtrowany odczyt; brak zapisu dokumentów z rozmowy",
      status: "active" as const,
    },
    {
      id: "rate-limit",
      name: "Limit wiadomości",
      detail: "Maksymalnie 50 wiadomości użytkownika na godzinę",
      status: "active" as const,
    },
    {
      id: "token-budget",
      name: "Dzienny budżet tokenów",
      detail: `Limit ${dailyTokenLimit.toLocaleString("pl-PL")} tokenów na użytkownika dziennie`,
      status: "active" as const,
    },
    {
      id: "audit-log",
      name: "Rejestr zdarzeń",
      detail: "Logowanie wejścia, wyjścia, blokad i limitów",
      status: "active" as const,
    },
    {
      id: "violation-counter",
      name: "Licznik naruszeń",
      detail: violationResult.error
        ? "Migracja licznika naruszeń nie została jeszcze zastosowana"
        : "Agregacja za godzinę, 24 godziny i cały okres",
      status: violationResult.error ? ("warning" as const) : ("active" as const),
    },
  ];

  const alerts = [
    ...topUsers
      .filter((user) => user.dailyLimitPercent >= 80)
      .map((user) => ({
        id: `budget-${user.userId}`,
        severity: user.dailyLimitPercent >= 100 ? "critical" : "warning",
        title: "Wysokie zużycie tokenów",
        detail: `${user.email}: ${user.dailyLimitPercent}% dziennego limitu`,
        createdAt: new Date().toISOString(),
      })),
    ...frequencyRows.map((row) => ({
      id: `frequency-${row.user_id}`,
      severity: "critical",
      title: "Wysoka częstotliwość wiadomości",
      detail: `${displayUser(row.user_id)}: ${toNumber(
        row.messages_last_10_minutes,
      )} wiadomości w 10 minut`,
      createdAt: new Date().toISOString(),
    })),
    ...violationCounters
      .filter((row) => row.lastHour >= 2)
      .map((row) => ({
        id: `violations-${row.userId}`,
        severity: "critical" as const,
        title: "Powtarzające się naruszenia",
        detail: `${row.user}: ${row.lastHour} naruszeń w ostatniej godzinie`,
        createdAt: row.lastViolationAt,
      })),
    ...blockedMessages.slice(0, 10).map((row) => ({
      id: `blocked-${row.id}`,
      severity: "warning",
      title: "Wiadomość zablokowana",
      detail: `${row.user}: ${row.reason}`,
      createdAt: row.createdAt,
    })),
  ];

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      tokensToday: toNumber(stats.tokens_today),
      tokensWeek: toNumber(stats.tokens_week),
      blockedMessages: toNumber(stats.blocked_messages),
      averageTokensPerUser: toNumber(stats.average_tokens_per_user),
      dailyTokenLimit,
    },
    topUsers,
    alerts,
    blockedMessages,
    violationCounters,
    diagnostics,
  };
}
