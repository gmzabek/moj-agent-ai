"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../../../lib/authenticatedFetch";
import styles from "./UsageDashboard.module.css";

type DashboardData = {
  generatedAt: string;
  pricing: {
    currency: "USD";
    inputPerMillion: number;
    outputPerMillion: number;
  };
  stats: {
    users: number;
    conversations: number;
    tokensToday: number;
    costToday: number;
  };
  daily: Array<{
    date: string;
    label: string;
    tokens: number;
    conversations: number;
  }>;
  endpoints: Array<{
    endpoint: string;
    tokens: number;
    percentage: number;
    color: string;
  }>;
  recentConversations: Array<{
    id: string;
    userId: string;
    email: string;
    title: string;
    updatedAt: string;
    messageCount: number;
  }>;
};

const numberFormatter = new Intl.NumberFormat("pl-PL");
const compactFormatter = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 1,
  notation: "compact",
});

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatCompact(value: number) {
  return value >= 10_000 ? compactFormatter.format(value) : formatNumber(value);
}

function formatCost(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value < 0.01 ? 4 : 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

async function fetchDashboard() {
  const response = await authenticatedFetch("/api/admin/dashboard", {
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as
    | DashboardData
    | { error?: string }
    | null;

  if (!response.ok || !result || !("stats" in result)) {
    throw new Error(
      result && "error" in result
        ? (result.error ?? "Nie udało się pobrać dashboardu.")
        : "Nie udało się pobrać dashboardu.",
    );
  }

  return result;
}

function TokenLineChart({ data }: { data: DashboardData["daily"] }) {
  const width = 720;
  const height = 250;
  const left = 54;
  const right = 18;
  const top = 20;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...data.map((day) => day.tokens), 1);
  const points = data.map((day, index) => ({
    ...day,
    x: left + (index / Math.max(data.length - 1, 1)) * chartWidth,
    y: top + chartHeight - (day.tokens / maxValue) * chartHeight,
  }));
  const line = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${line} L ${points.at(-1)?.x ?? left} ${top + chartHeight} L ${left} ${top + chartHeight} Z`;

  return (
    <div className={styles.lineChart}>
      <svg
        aria-label="Tokeny wykorzystane każdego dnia w ostatnich siedmiu dniach"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="usage-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8cf0b5" stopOpacity="0.34" />
            <stop offset="1" stopColor="#8cf0b5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line className={styles.gridLine} x1={left} x2={width - right} y1={y} y2={y} />
              <text className={styles.axisText} x={left - 10} y={y + 4} textAnchor="end">
                {formatCompact(maxValue * ratio)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#usage-area)" />
        <path className={styles.linePath} d={line} />
        {points.map((point) => (
          <g key={point.date}>
            <circle className={styles.linePoint} cx={point.x} cy={point.y} r="4.5">
              <title>{`${point.label}: ${formatNumber(point.tokens)} tokenów`}</title>
            </circle>
            <text className={styles.dayText} x={point.x} y={height - 12} textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ConversationBarChart({ data }: { data: DashboardData["daily"] }) {
  const maxValue = Math.max(...data.map((day) => day.conversations), 1);

  return (
    <div className={styles.barChart} aria-label="Rozmowy dziennie z ostatnich siedmiu dni">
      {data.map((day) => (
        <div className={styles.barColumn} key={day.date}>
          <strong>{day.conversations}</strong>
          <div className={styles.barTrack}>
            <span style={{ height: `${Math.max((day.conversations / maxValue) * 100, 3)}%` }} />
          </div>
          <small>{day.label}</small>
        </div>
      ))}
    </div>
  );
}

function EndpointDonut({ data }: { data: DashboardData["endpoints"] }) {
  const total = data.reduce((sum, entry) => sum + entry.tokens, 0);
  let cursor = 0;
  const gradient = total
    ? data
        .map((entry) => {
          const start = cursor;
          cursor += (entry.tokens / total) * 100;
          return `${entry.color} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#252a36 0% 100%";

  return (
    <div className={styles.donutLayout}>
      <div
        aria-label={`Podział ${formatNumber(total)} tokenów według endpointu`}
        className={styles.donut}
        role="img"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div>
          <strong>{formatCompact(total)}</strong>
          <span>tokenów</span>
        </div>
      </div>
      <div className={styles.legend}>
        {data.map((entry) => (
          <div key={entry.endpoint}>
            <i style={{ background: entry.color }} />
            <span>{entry.endpoint}</span>
            <strong>{entry.percentage}%</strong>
            <small>{formatNumber(entry.tokens)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsageDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await fetchDashboard());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się pobrać dashboardu.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchDashboard()
      .then((result) => {
        if (isCurrent) setData(result);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać dashboardu.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const pricingText = useMemo(
    () =>
      data
        ? `Estymacja: $${data.pricing.inputPerMillion}/1M tokenów wejściowych i $${data.pricing.outputPerMillion}/1M wyjściowych`
        : "",
    [data],
  );

  if (isLoading && !data) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingCard}>
          <span className={styles.spinner} aria-hidden="true" />
          <div>
            <strong>Ładuję dashboard LEO</strong>
            <p>Agreguję rozmowy, użytkowników i użycie tokenów.</p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className={styles.page}>
        <section className={styles.errorCard}>
          <span aria-hidden="true">📊</span>
          <h1>Dashboard jest niedostępny</h1>
          <p>{error}</p>
          <button onClick={() => void loadDashboard()} type="button">
            Spróbuj ponownie
          </button>
        </section>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ADMIN / ANALITYKA</span>
          <h1>📊 Dashboard użycia</h1>
          <p>Rozmowy, aktywność i koszty działania LEO w jednym miejscu.</p>
        </div>
        <div className={styles.headerActions}>
          <span>Aktualizacja: {formatDate(data.generatedAt)}</span>
          <button disabled={isLoading} onClick={() => void loadDashboard()} type="button">
            {isLoading ? "Odświeżam…" : "Odśwież dane"}
          </button>
        </div>
      </header>

      {error ? <div className={styles.inlineError}>{error}</div> : null}

      <section className={styles.statsGrid} aria-label="Najważniejsze statystyki użycia">
        <article className={styles.statCard}>
          <span className={styles.statIcon}>👥</span>
          <div><small>Użytkownicy</small><strong>{formatNumber(data.stats.users)}</strong></div>
          <p>Unikalni użytkownicy rozmów</p>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon}>💬</span>
          <div><small>Rozmowy</small><strong>{formatNumber(data.stats.conversations)}</strong></div>
          <p>Wszystkie zapisane konwersacje</p>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon}>🔤</span>
          <div><small>Tokeny dzisiaj</small><strong>{formatNumber(data.stats.tokensToday)}</strong></div>
          <p>Wejście i wyjście modelu</p>
        </article>
        <article className={`${styles.statCard} ${styles.costCard}`}>
          <span className={styles.statIcon}>💰</span>
          <div><small>Koszt dzisiaj</small><strong>{formatCost(data.stats.costToday)}</strong></div>
          <p title={pricingText}>{pricingText}</p>
        </article>
      </section>

      <section className={`${styles.panel} ${styles.linePanel}`}>
        <div className={styles.panelHeader}>
          <div><span>TREND 7 DNI</span><h2>Tokeny dziennie</h2></div>
          <strong>{formatNumber(data.daily.reduce((sum, day) => sum + day.tokens, 0))} tokenów</strong>
        </div>
        <TokenLineChart data={data.daily} />
      </section>

      <div className={styles.chartGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><span>AKTYWNOŚĆ</span><h2>Rozmowy dziennie</h2></div>
          </div>
          <ConversationBarChart data={data.daily} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><span>STRUKTURA UŻYCIA</span><h2>Tokeny per endpoint</h2></div>
          </div>
          <EndpointDonut data={data.endpoints} />
        </section>
      </div>

      <section className={`${styles.panel} ${styles.tablePanel}`}>
        <div className={styles.panelHeader}>
          <div><span>OSTATNIA AKTYWNOŚĆ</span><h2>Ostatnie rozmowy</h2></div>
          <strong>{data.recentConversations.length} najnowszych</strong>
        </div>
        {data.recentConversations.length ? (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th>Użytkownik</th><th>Tytuł rozmowy</th><th>Data</th><th>Wiadomości</th></tr></thead>
              <tbody>
                {data.recentConversations.map((conversation) => (
                  <tr key={conversation.id}>
                    <td><strong title={conversation.email}>{conversation.email}</strong><small>{conversation.userId.slice(0, 8)}</small></td>
                    <td>{conversation.title}</td>
                    <td><time dateTime={conversation.updatedAt}>{formatDate(conversation.updatedAt)}</time></td>
                    <td><span className={styles.messageCount}>{conversation.messageCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}><span>💬</span><strong>Brak rozmów</strong><p>Pierwsze rozmowy pojawią się tutaj automatycznie.</p></div>
        )}
      </section>
    </main>
  );
}
