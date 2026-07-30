"use client";

import { useEffect, useMemo, useState } from "react";
import { MarkdownView } from "@/app/components/MarkdownView";
import { authenticatedFetch } from "@/lib/authenticatedFetch";
import styles from "./Briefings.module.css";

type Briefing = {
  id: string;
  created_at: string;
  content: string;
  date: string;
  user_id: string | null;
};

function formatBriefingDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const datePart = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
    year: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "long",
  }).format(date);

  return `${datePart}, ${weekday}`;
}

function createPreview(content: string) {
  const plainText = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return plainText.length > 150
    ? `${plainText.slice(0, 150).trimEnd()}…`
    : plainText;
}

async function fetchBriefings() {
  const response = await authenticatedFetch("/api/briefings", {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as {
    briefings?: Briefing[];
    error?: string;
  } | null;

  if (!response.ok || !data?.briefings) {
    throw new Error(data?.error ?? "Nie udało się pobrać briefingów.");
  }

  return data.briefings;
}

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => briefings.find((briefing) => briefing.id === selectedId) ?? null,
    [briefings, selectedId],
  );

  useEffect(() => {
    let isActive = true;

    void fetchBriefings()
      .then((nextBriefings) => {
        if (isActive) {
          setBriefings(nextBriefings);
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nie udało się pobrać briefingów.",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function generateBriefing() {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/cron/morning", {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        briefing?: Pick<Briefing, "content" | "date" | "id">;
        error?: string;
      } | null;

      if (!response.ok || !data?.briefing) {
        throw new Error(data?.error ?? "Nie udało się wygenerować briefingu.");
      }

      const nextBriefings = await fetchBriefings();
      setBriefings(nextBriefings);
      setSelectedId(data.briefing.id);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Nie udało się wygenerować briefingu.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyBriefing() {
    if (!selected) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selected.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Nie udało się skopiować treści do schowka.");
    }
  }

  if (selected) {
    return (
      <main className={styles.page}>
        <div className={styles.detailToolbar}>
          <button
            className={styles.backButton}
            onClick={() => {
              setCopied(false);
              setSelectedId(null);
            }}
            type="button"
          >
            <span aria-hidden="true">←</span>
            Wróć do briefingów
          </button>
          <button
            className={styles.copyButton}
            onClick={() => void copyBriefing()}
            type="button"
          >
            {copied ? "✓ Skopiowano" : "📋 Kopiuj"}
          </button>
        </div>

        <article className={styles.detailCard}>
          <header className={styles.detailHeader}>
            <div>
              <span className={styles.eyebrow}>PORANNY BRIEFING</span>
              <h1>{formatBriefingDate(selected.date)}</h1>
            </div>
            <span className={styles.status}>
              <i aria-hidden="true" />
              Wygenerowany automatycznie
            </span>
          </header>
          <div className={styles.document}>
            <MarkdownView text={selected.content} />
          </div>
        </article>

        <p className={styles.copyStatus} aria-live="polite">
          {copied ? "Treść briefingu została skopiowana do schowka." : ""}
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>CODZIENNY PRZEGLĄD</span>
          <h1>📰 Briefingi</h1>
          <p>Automatyczne podsumowania dnia od Twojego agenta</p>
        </div>
        <button
          className={styles.generateButton}
          disabled={isGenerating}
          onClick={() => void generateBriefing()}
          type="button"
        >
          {isGenerating ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Generuję…
            </>
          ) : (
            <>
              <span aria-hidden="true">✦</span>
              Wygeneruj teraz
            </>
          )}
        </button>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Nie udało się wykonać operacji</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <section className={styles.loading} aria-label="Ładowanie briefingów">
          <span className={styles.spinner} aria-hidden="true" />
          Pobieram briefingi…
        </section>
      ) : briefings.length === 0 ? (
        <section className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            🗞️
          </div>
          <h2>Brak briefingów</h2>
          <p>Brak briefingów. Cron job wygeneruje pierwszy jutro rano!</p>
          <button
            disabled={isGenerating}
            onClick={() => void generateBriefing()}
            type="button"
          >
            {isGenerating ? "Generuję…" : "🔄 Wygeneruj teraz"}
          </button>
        </section>
      ) : (
        <>
          <div className={styles.listMeta}>
            <span>OSTATNIE BRIEFINGI</span>
            <strong>{briefings.length}</strong>
          </div>
          <section className={styles.grid} aria-label="Lista briefingów">
            {briefings.map((briefing) => (
              <button
                className={styles.card}
                key={briefing.id}
                onClick={() => setSelectedId(briefing.id)}
                type="button"
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    ☀️
                  </span>
                  <span className={styles.cardDate}>
                    {formatBriefingDate(briefing.date)}
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    ↗
                  </span>
                </div>
                <p>{createPreview(briefing.content)}</p>
                <div className={styles.cardFooter}>
                  <span>
                    ✅ wygenerowany automatycznie (z cron)
                  </span>
                  <time dateTime={briefing.created_at}>
                    {new Intl.DateTimeFormat("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(briefing.created_at))}
                  </time>
                </div>
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
