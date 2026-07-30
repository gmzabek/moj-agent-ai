"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "../../../lib/authenticatedFetch";
import styles from "./SecurityDashboard.module.css";

type SecurityDashboardData = {
  generatedAt: string;
  stats: {
    tokensToday: number;
    tokensWeek: number;
    blockedMessages: number;
    averageTokensPerUser: number;
  };
  topUsers: Array<{
    userId: string;
    email: string;
    tokensToday: number;
    tokensWeek: number;
    dailyLimitPercent: number;
  }>;
  alerts: Array<{
    id: string;
    severity: "critical" | "warning";
    title: string;
    detail: string;
    createdAt: string;
  }>;
  blockedMessages: Array<{
    id: string;
    userId: string;
    user: string;
    message: string;
    reason: string;
    stage: "input" | "output" | "rate_limit";
    endpoint: string;
    createdAt: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("pl-PL");

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function stageLabel(stage: "input" | "output" | "rate_limit") {
  if (stage === "input") return "Wejście";
  if (stage === "output") return "Wyjście";
  return "Limit";
}

async function fetchDashboardData() {
  const response = await authenticatedFetch("/api/admin/security", {
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as
    | SecurityDashboardData
    | { error?: string }
    | null;

  if (
    !response.ok ||
    !result ||
    !("stats" in result) ||
    !("topUsers" in result)
  ) {
    throw new Error(
      result && "error" in result
        ? (result.error ?? "Nie udało się pobrać danych bezpieczeństwa.")
        : "Nie udało się pobrać danych bezpieczeństwa.",
    );
  }

  return result;
}

export default function SecurityDashboardPage() {
  const [data, setData] = useState<SecurityDashboardData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setData(await fetchDashboardData());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się pobrać danych bezpieczeństwa.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchDashboardData()
      .then((result) => {
        if (isCurrent) setData(result);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nie udało się pobrać danych bezpieczeństwa.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (isLoading && !data) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingCard}>
          <span className={styles.spinner} aria-hidden="true" />
          <div>
            <strong>Ładuję panel bezpieczeństwa</strong>
            <p>Analizuję logi, wykorzystanie tokenów i alerty.</p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className={styles.page}>
        <section className={styles.errorCard}>
          <span aria-hidden="true">🔒</span>
          <h1>Panel bezpieczeństwa jest niedostępny</h1>
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
          <span className={styles.eyebrow}>ADMIN / SECURITY</span>
          <h1>🛡️ Panel bezpieczeństwa</h1>
          <p>
            Monitoring limitów, podejrzanych wiadomości i aktywnych alertów.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span>Aktualizacja: {formatDate(data.generatedAt)}</span>
          <button
            disabled={isLoading}
            onClick={() => void loadDashboard()}
            type="button"
          >
            {isLoading ? "Odświeżam…" : "Odśwież dane"}
          </button>
        </div>
      </header>

      {error ? <div className={styles.inlineError}>{error}</div> : null}

      <section className={styles.statsGrid} aria-label="Statystyki bezpieczeństwa">
        <article className={styles.statCard}>
          <span>Tokeny dzisiaj</span>
          <strong>{formatNumber(data.stats.tokensToday)}</strong>
          <small>Bieżące zużycie wszystkich użytkowników</small>
        </article>
        <article className={styles.statCard}>
          <span>Tokeny w tym tygodniu</span>
          <strong>{formatNumber(data.stats.tokensWeek)}</strong>
          <small>Suma od początku tygodnia</small>
        </article>
        <article className={`${styles.statCard} ${styles.dangerStat}`}>
          <span>Zablokowane wiadomości</span>
          <strong>{formatNumber(data.stats.blockedMessages)}</strong>
          <small>Wykryte przez reguły bezpieczeństwa</small>
        </article>
        <article className={styles.statCard}>
          <span>Średnio na użytkownika</span>
          <strong>{formatNumber(data.stats.averageTokensPerUser)}</strong>
          <small>Tokenów w bieżącym tygodniu</small>
        </article>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>SYGNAŁY</span>
              <h2>Aktywne alerty</h2>
            </div>
            <span className={styles.countBadge}>{data.alerts.length}</span>
          </div>

          {data.alerts.length ? (
            <div className={styles.alertList}>
              {data.alerts.map((alert) => (
                <article
                  className={`${styles.alert} ${
                    alert.severity === "critical"
                      ? styles.alertCritical
                      : styles.alertWarning
                  }`}
                  key={alert.id}
                >
                  <span className={styles.alertIcon} aria-hidden="true">
                    {alert.severity === "critical" ? "!" : "⚠"}
                  </span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                    <time dateTime={alert.createdAt}>
                      {formatDate(alert.createdAt)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span aria-hidden="true">✓</span>
              <strong>Brak aktywnych alertów</strong>
              <p>Nie wykryto przekroczeń ani podejrzanej aktywności.</p>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>ZUŻYCIE</span>
              <h2>Top 5 użytkowników</h2>
            </div>
            <span className={styles.mutedBadge}>limit 10 000 / dzień</span>
          </div>

          {data.topUsers.length ? (
            <div className={styles.userList}>
              {data.topUsers.map((user, index) => (
                <article className={styles.userRow} key={user.userId}>
                  <span className={styles.rank}>{index + 1}</span>
                  <div className={styles.userDetails}>
                    <strong title={user.email}>{user.email}</strong>
                    <div className={styles.progressTrack}>
                      <span
                        className={
                          user.dailyLimitPercent >= 100
                            ? styles.progressCritical
                            : user.dailyLimitPercent >= 80
                              ? styles.progressWarning
                              : styles.progressNormal
                        }
                        style={{ width: `${user.dailyLimitPercent}%` }}
                      />
                    </div>
                    <small>
                      Dzisiaj {formatNumber(user.tokensToday)} · tydzień{" "}
                      {formatNumber(user.tokensWeek)}
                    </small>
                  </div>
                  <strong className={styles.percentage}>
                    {user.dailyLimitPercent}%
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span aria-hidden="true">—</span>
              <strong>Brak danych o zużyciu</strong>
              <p>Pierwsze wywołania API pojawią się tutaj automatycznie.</p>
            </div>
          )}
        </section>
      </div>

      <section className={`${styles.panel} ${styles.logsPanel}`}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.sectionLabel}>AUDYT</span>
            <h2>Logi podejrzanych wiadomości</h2>
          </div>
          <span className={styles.mutedBadge}>
            ostatnie {data.blockedMessages.length} wpisów
          </span>
        </div>

        {data.blockedMessages.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.logsTable}>
              <thead>
                <tr>
                  <th>Użytkownik</th>
                  <th>Wiadomość</th>
                  <th>Powód</th>
                  <th>Etap</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {data.blockedMessages.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong title={entry.user}>{entry.user}</strong>
                      <small>{entry.endpoint}</small>
                    </td>
                    <td className={styles.messageCell}>
                      {entry.message || "(brak treści)"}
                    </td>
                    <td>
                      <span className={styles.reasonBadge}>{entry.reason}</span>
                    </td>
                    <td>{stageLabel(entry.stage)}</td>
                    <td>
                      <time dateTime={entry.createdAt}>
                        {formatDate(entry.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">✓</span>
            <strong>Brak zablokowanych wiadomości</strong>
            <p>System nie zarejestrował dotąd podejrzanych treści.</p>
          </div>
        )}
      </section>
    </main>
  );
}
