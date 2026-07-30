"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import { MarkdownView } from "../components/MarkdownView";
import styles from "./Report.module.css";

const examples = [
  "Rynek AI w Polsce — trendy, firmy, prognozy na 2026",
  "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop",
  "Wpływ pracy zdalnej na produktywność — badania i statystyki",
  "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy",
];

type SavedReportSummary = {
  createdAt: string;
  id: string;
  sourceCount: number;
  topic: string;
  wordCount: number;
};

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getReportStats(report: string) {
  const words = report.trim() ? report.trim().split(/\s+/).length : 0;
  const sourceSection = report.split(/^##\s+Źródła\s*$/im)[1] ?? "";
  const uniqueLinks = new Set(
    Array.from(sourceSection.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)).map(
      (match) => match[1],
    ),
  );

  return {
    sources: uniqueLinks.size,
    words,
  };
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function getProgressLabel(elapsedSeconds: number, hasReport: boolean) {
  if (hasReport) {
    return "Piszę i formatuję raport…";
  }

  if (elapsedSeconds < 5) {
    return "Analizuję zakres tematu…";
  }

  if (elapsedSeconds < 14) {
    return "Szukam danych i źródeł…";
  }

  return "Weryfikuję fakty i wyciągam wnioski…";
}

export default function ReportPage() {
  const [topic, setTopic] = useState("");
  const [report, setReport] = useState("");
  const [reportTopic, setReportTopic] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportSummary[]>([]);
  const [savedReportsError, setSavedReportsError] = useState("");
  const [isLoadingSavedReports, setIsLoadingSavedReports] = useState(true);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const stats = useMemo(() => getReportStats(report), [report]);

  const loadSavedReports = useCallback(async () => {
    setIsLoadingSavedReports(true);
    setSavedReportsError("");

    try {
      const response = await authenticatedFetch("/api/reports");
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        reports?: SavedReportSummary[];
      } | null;

      if (!response.ok || !data?.reports) {
        throw new Error(
          data?.error || "Nie udało się pobrać zapisanych raportów.",
        );
      }

      setSavedReports(data.reports);
    } catch (caughtError) {
      setSavedReportsError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się pobrać zapisanych raportów.",
      );
    } finally {
      setIsLoadingSavedReports(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSavedReports();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSavedReports]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  async function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTopic = topic.trim();

    if (normalizedTopic.length < 5 || isLoading) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setElapsedSeconds(0);
    setReport("");
    setReportTopic(normalizedTopic);
    setError("");
    setIsCopied(false);
    setSavedReportId(null);

    try {
      const response = await fetch("/api/report", {
        body: JSON.stringify({ topic: normalizedTopic }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(data?.error || "Nie udało się wygenerować raportu.");
      }

      if (!response.body) {
        throw new Error("Serwer nie zwrócił strumienia raportu.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completeReport = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          completeReport += decoder.decode();
          setReport(completeReport);
          break;
        }

        completeReport += decoder.decode(value, { stream: true });
        setReport(completeReport);
      }

      if (!completeReport.trim()) {
        throw new Error("Model zakończył pracę bez treści raportu.");
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się wygenerować raportu.",
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }

  async function copyReport() {
    try {
      await copyText(report);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2_000);
    } catch {
      setError("Nie udało się skopiować raportu. Zaznacz tekst i skopiuj go ręcznie.");
    }
  }

  async function saveReport() {
    if (!report || !reportTopic || isLoading || isSaving || savedReportId) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await authenticatedFetch("/api/reports", {
        body: JSON.stringify({
          content: report,
          topic: reportTopic,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        report?: { id?: string };
      } | null;

      if (!response.ok || !data?.report?.id) {
        throw new Error(data?.error || "Nie udało się zapisać raportu.");
      }

      setSavedReportId(data.report.id);
      await loadSavedReports();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się zapisać raportu.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openSavedReport(reportId: string) {
    if (openingReportId || isLoading) {
      return;
    }

    setOpeningReportId(reportId);
    setError("");

    try {
      const response = await authenticatedFetch(
        `/api/reports/${encodeURIComponent(reportId)}`,
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        report?: {
          content?: string;
          id?: string;
          topic?: string;
        };
      } | null;

      if (
        !response.ok ||
        !data?.report?.id ||
        !data.report.content ||
        !data.report.topic
      ) {
        throw new Error(data?.error || "Nie udało się otworzyć raportu.");
      }

      setReport(data.report.content);
      setReportTopic(data.report.topic);
      setTopic(data.report.topic);
      setSavedReportId(data.report.id);
      setIsCopied(false);
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się otworzyć raportu.",
      );
    } finally {
      setOpeningReportId(null);
    }
  }

  function cancelGeneration() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }

  const progressLabel = getProgressLabel(elapsedSeconds, Boolean(report));

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>AUTONOMICZNY RESEARCH</span>
        <h1>📊 Generator raportów</h1>
        <p>Opisz temat — agent napisze raport biznesowy</p>
      </header>

      <section className={styles.workspace}>
        <form className={styles.form} onSubmit={generateReport}>
          <label htmlFor="report-topic">O czym ma być raport?</label>
          <div className={styles.inputRow}>
            <input
              autoComplete="off"
              disabled={isLoading}
              id="report-topic"
              maxLength={300}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Np. Rynek AI w Polsce w 2026 roku..."
              value={topic}
            />
            <button
              disabled={isLoading || topic.trim().length < 5}
              type="submit"
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Pracuję…
                </>
              ) : (
                "📊 Generuj raport"
              )}
            </button>
          </div>
          <div className={styles.inputMeta}>
            <span>Raport: 500–1000 słów, dane, analiza i źródła</span>
            <span>{topic.length}/300</span>
          </div>
        </form>

        <div className={styles.examples}>
          <span>WYPRÓBUJ PRZYKŁAD</span>
          <div>
            {examples.map((example) => (
              <button
                disabled={isLoading}
                key={example}
                onClick={() => {
                  setTopic(example);
                  setError("");
                }}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.savedLibrary} aria-label="Zapisane raporty">
        <header className={styles.libraryHeader}>
          <div>
            <span>PRYWATNA BIBLIOTEKA</span>
            <h2>💾 Zapisane raporty</h2>
            <p>Otwieraj raporty zapisane na Twoim koncie Supabase.</p>
          </div>
          <div className={styles.libraryControls}>
            <strong>{savedReports.length}</strong>
            <button
              disabled={isLoadingSavedReports}
              onClick={() => void loadSavedReports()}
              type="button"
            >
              {isLoadingSavedReports ? "Odświeżam…" : "↻ Odśwież"}
            </button>
          </div>
        </header>

        {savedReportsError ? (
          <p className={styles.libraryError} role="alert">
            {savedReportsError}
          </p>
        ) : null}

        {isLoadingSavedReports && savedReports.length === 0 ? (
          <div className={styles.libraryLoading} aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            Pobieram zapisane raporty…
          </div>
        ) : null}

        {!isLoadingSavedReports &&
        !savedReportsError &&
        savedReports.length === 0 ? (
          <div className={styles.libraryEmpty}>
            <span aria-hidden="true">▤</span>
            <p>Nie masz jeszcze zapisanych raportów.</p>
          </div>
        ) : null}

        {savedReports.length > 0 ? (
          <ul className={styles.reportList}>
            {savedReports.map((savedReport) => (
              <li key={savedReport.id}>
                <button
                  aria-current={
                    savedReportId === savedReport.id ? "true" : undefined
                  }
                  disabled={Boolean(openingReportId) || isLoading}
                  onClick={() => void openSavedReport(savedReport.id)}
                  type="button"
                >
                  <span className={styles.reportListIcon} aria-hidden="true">
                    📄
                  </span>
                  <span className={styles.reportListContent}>
                    <strong>{savedReport.topic}</strong>
                    <small>
                      {formatReportDate(savedReport.createdAt)}
                      <i aria-hidden="true" />
                      {savedReport.wordCount} słów
                      <i aria-hidden="true" />
                      {savedReport.sourceCount} źródeł
                    </small>
                  </span>
                  <span className={styles.openLabel}>
                    {openingReportId === savedReport.id
                      ? "Otwieram…"
                      : savedReportId === savedReport.id
                        ? "Otwarto"
                        : "Otwórz →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {error ? (
        <div className={styles.error} role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Operacja nie powiodła się</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <section className={styles.progress} aria-live="polite">
          <div className={styles.progressIcon}>
            <span aria-hidden="true">◎</span>
          </div>
          <div className={styles.progressText}>
            <span>AGENT ANALITYCZNY</span>
            <strong>{progressLabel}</strong>
            <small>
              {report
                ? "Treść pojawia się na żywo poniżej."
                : "Research może potrwać kilkadziesiąt sekund."}
            </small>
          </div>
          <div className={styles.progressActions}>
            <time>{elapsedSeconds}s</time>
            <button onClick={cancelGeneration} type="button">
              Anuluj
            </button>
          </div>
        </section>
      ) : null}

      {report ? (
        <section
          className={styles.result}
          aria-label="Wygenerowany raport"
          ref={resultRef}
        >
          <header className={styles.resultHeader}>
            <div>
              <span>
                {isLoading
                  ? "RAPORT POWSTAJE"
                  : savedReportId
                    ? "ZAPISANY RAPORT"
                    : "GOTOWY RAPORT"}
              </span>
              <div className={styles.stats}>
                <span>{stats.words} słów</span>
                <i aria-hidden="true" />
                <span>
                  {stats.sources > 0
                    ? `${stats.sources} źródeł`
                    : "źródła w raporcie"}
                </span>
              </div>
            </div>
            <div className={styles.resultActions}>
              <button
                className={styles.copyButton}
                disabled={isLoading}
                onClick={() => void copyReport()}
                type="button"
              >
                {isCopied ? "✓ Skopiowano" : "📋 Kopiuj do schowka"}
              </button>
              <button
                className={styles.saveButton}
                disabled={isLoading || isSaving || Boolean(savedReportId)}
                onClick={() => void saveReport()}
                type="button"
              >
                {savedReportId
                  ? "✓ Zapisano w bazie"
                  : isSaving
                    ? "Zapisuję…"
                    : "💾 Zapisz w bazie"}
              </button>
            </div>
          </header>

          {savedReportId ? (
            <p className={styles.savedNotice} role="status">
              Raport znajduje się w Twojej prywatnej bibliotece.
              <span>ID: {savedReportId}</span>
            </p>
          ) : null}

          <article className={styles.document}>
            <MarkdownView text={report} />
            {isLoading ? <span className={styles.streamCursor} /> : null}
          </article>
        </section>
      ) : null}

      {!report && !isLoading ? (
        <section className={styles.emptyState}>
          <div aria-hidden="true">⌁</div>
          <h2>Od tematu do rekomendacji</h2>
          <p>
            Agent zbierze informacje, porówna dane i odda gotowy raport ze
            źródłami.
          </p>
          <ol>
            <li>
              <span>01</span>
              Research
            </li>
            <li>
              <span>02</span>
              Analiza
            </li>
            <li>
              <span>03</span>
              Raport
            </li>
          </ol>
        </section>
      ) : null}
    </main>
  );
}
