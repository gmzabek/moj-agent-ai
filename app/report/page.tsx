"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownView } from "../components/MarkdownView";
import styles from "./Report.module.css";

const examples = [
  "Rynek AI w Polsce — trendy, firmy, prognozy na 2026",
  "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop",
  "Wpływ pracy zdalnej na produktywność — badania i statystyki",
  "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy",
];

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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stats = useMemo(() => getReportStats(report), [report]);

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
    setError("");
    setIsCopied(false);

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

      {error ? (
        <div className={styles.error} role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Generowanie raportu nie powiodło się</strong>
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
        <section className={styles.result} aria-label="Wygenerowany raport">
          <header className={styles.resultHeader}>
            <div>
              <span>{isLoading ? "RAPORT POWSTAJE" : "GOTOWY RAPORT"}</span>
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
            <button
              className={styles.copyButton}
              disabled={isLoading}
              onClick={() => void copyReport()}
              type="button"
            >
              {isCopied ? "✓ Skopiowano" : "📋 Kopiuj do schowka"}
            </button>
          </header>

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
