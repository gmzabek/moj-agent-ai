"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import { MarkdownView } from "../components/MarkdownView";
import styles from "./Competitor.module.css";

type Companies = [string, string, string];

const examples: Array<{
  companies: Companies;
  context: string;
}> = [
  {
    companies: ["Shopify", "WooCommerce", "PrestaShop"],
    context: "Szukam platformy e-commerce dla małego sklepu internetowego.",
  },
  {
    companies: ["Notion", "Obsidian", "Evernote"],
    context: "Potrzebuję narzędzia do zarządzania wiedzą dla małego zespołu.",
  },
  {
    companies: ["Vercel", "Netlify", "Railway"],
    context: "Wybieram platformę do wdrażania aplikacji webowej dla startupu.",
  },
  {
    companies: ["ChatGPT", "Claude", "Gemini"],
    context: "Szukam asystenta AI do analizy dokumentów i pracy biznesowej.",
  },
];

function getAnalysisStats(analysis: string) {
  const words = analysis.trim() ? analysis.trim().split(/\s+/).length : 0;
  const sourceSection = analysis.split(/^##\s+Źródła\s*$/im)[1] ?? "";
  const sources = new Set(
    Array.from(sourceSection.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)).map(
      (match) => match[1],
    ),
  ).size;

  return { sources, words };
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

function getProgressLabel(seconds: number, hasAnalysis: boolean) {
  if (hasAnalysis) {
    return "Buduję tabelę i rekomendację…";
  }

  if (seconds < 6) {
    return "Rozpoznaję firmy i zakres porównania…";
  }

  if (seconds < 18) {
    return "Zbieram dane o każdej firmie…";
  }

  return "Weryfikuję ceny, funkcje i źródła…";
}

export default function CompetitorPage() {
  const [companies, setCompanies] = useState<Companies>(["", "", ""]);
  const [context, setContext] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const stats = useMemo(() => getAnalysisStats(analysis), [analysis]);
  const normalizedCompanies = companies.map((company) => company.trim());
  const isValid =
    normalizedCompanies.every((company) => company.length >= 2) &&
    new Set(
      normalizedCompanies.map((company) => company.toLocaleLowerCase("pl")),
    ).size === 3;

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
    return () => controllerRef.current?.abort();
  }, []);

  function updateCompany(index: number, value: string) {
    setCompanies(
      (current) =>
        current.map((company, companyIndex) =>
          companyIndex === index ? value : company,
        ) as Companies,
    );
  }

  async function compareCompanies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || isLoading) {
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setElapsedSeconds(0);
    setAnalysis("");
    setError("");
    setIsCopied(false);

    try {
      const response = await authenticatedFetch("/api/competitor", {
        body: JSON.stringify({
          companies: normalizedCompanies,
          context: context.trim(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          data?.error || "Nie udało się przygotować analizy konkurencji.",
        );
      }

      if (!response.body) {
        throw new Error("Serwer nie zwrócił strumienia analizy.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completeAnalysis = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          completeAnalysis += decoder.decode();
          setAnalysis(completeAnalysis);
          break;
        }

        completeAnalysis += decoder.decode(value, { stream: true });
        setAnalysis(completeAnalysis);
      }

      if (!completeAnalysis.trim()) {
        throw new Error("Model zakończył pracę bez treści analizy.");
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się przygotować analizy konkurencji.",
      );
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsLoading(false);
      }
    }
  }

  async function copyAnalysis() {
    try {
      await copyText(analysis);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2_000);
    } catch {
      setError(
        "Nie udało się skopiować analizy. Zaznacz tekst i skopiuj go ręcznie.",
      );
    }
  }

  function cancelAnalysis() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsLoading(false);
  }

  const progressLabel = getProgressLabel(elapsedSeconds, Boolean(analysis));

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>RESEARCH KONKURENCYJNY</span>
        <h1>🏢 Analiza konkurencji</h1>
        <p>Podaj firmy — agent porówna je za Ciebie</p>
      </header>

      <section className={styles.workspace}>
        <form onSubmit={compareCompanies}>
          <div className={styles.companyGrid}>
            {companies.map((company, index) => (
              <label key={index}>
                <span>
                  Firma {index + 1}
                  <small>0{index + 1}</small>
                </span>
                <input
                  autoComplete="off"
                  disabled={isLoading}
                  maxLength={100}
                  onChange={(event) => updateCompany(index, event.target.value)}
                  placeholder={
                    index === 0
                      ? "Np. Shopify"
                      : index === 1
                        ? "Np. WooCommerce"
                        : "Np. PrestaShop"
                  }
                  value={company}
                />
              </label>
            ))}
          </div>

          <label className={styles.contextLabel}>
            <span>
              Kontekst decyzji <small>opcjonalnie</small>
            </span>
            <textarea
              disabled={isLoading}
              maxLength={1_000}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Np. Szukam platformy e-commerce dla małego sklepu..."
              value={context}
            />
          </label>

          <div className={styles.formFooter}>
            <span>
              {!isValid && companies.some((company) => company.trim())
                ? "Podaj trzy różne nazwy"
                : "Porównanie funkcji, cen, mocnych i słabych stron"}
            </span>
            <button disabled={!isValid || isLoading} type="submit">
              {isLoading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Porównuję…
                </>
              ) : (
                "🔍 Porównaj"
              )}
            </button>
          </div>
        </form>

        <div className={styles.examples}>
          <span>GOTOWE ZESTAWY</span>
          <div>
            {examples.map((example) => (
              <button
                disabled={isLoading}
                key={example.companies.join("-")}
                onClick={() => {
                  setCompanies(example.companies);
                  setContext(example.context);
                  setError("");
                }}
                type="button"
              >
                {example.companies.join(" vs ")}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className={styles.error} role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Analiza nie powiodła się</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <section className={styles.progress} aria-live="polite">
          <div className={styles.progressCompanies} aria-hidden="true">
            {normalizedCompanies.map((company, index) => (
              <span key={`${company}-${index}`}>
                {company.slice(0, 1).toLocaleUpperCase("pl")}
              </span>
            ))}
          </div>
          <div className={styles.progressText}>
            <span>AGENT ANALITYCZNY</span>
            <strong>{progressLabel}</strong>
            <small>
              {analysis
                ? "Analiza pojawia się na żywo poniżej."
                : "Research trzech firm może potrwać kilkadziesiąt sekund."}
            </small>
          </div>
          <div className={styles.progressActions}>
            <time>{elapsedSeconds}s</time>
            <button onClick={cancelAnalysis} type="button">
              Anuluj
            </button>
          </div>
        </section>
      ) : null}

      {analysis ? (
        <section className={styles.result} aria-label="Analiza konkurencji">
          <header className={styles.resultHeader}>
            <div>
              <span>{isLoading ? "ANALIZA POWSTAJE" : "GOTOWA ANALIZA"}</span>
              <div className={styles.stats}>
                <span>{stats.words} słów</span>
                <i aria-hidden="true" />
                <span>
                  {stats.sources > 0
                    ? `${stats.sources} źródeł`
                    : "źródła w analizie"}
                </span>
              </div>
            </div>
            <button
              disabled={isLoading}
              onClick={() => void copyAnalysis()}
              type="button"
            >
              {isCopied ? "✓ Skopiowano" : "📋 Kopiuj analizę"}
            </button>
          </header>

          <article className={styles.document}>
            <MarkdownView text={analysis} />
            {isLoading ? <span className={styles.streamCursor} /> : null}
          </article>
        </section>
      ) : null}

      {!analysis && !isLoading ? (
        <section className={styles.emptyState}>
          <div className={styles.versus} aria-hidden="true">
            <span>A</span>
            <b>VS</b>
            <span>B</span>
            <b>VS</b>
            <span>C</span>
          </div>
          <h2>Trzy firmy. Jedna decyzja.</h2>
          <p>
            Agent zbierze fakty, ułoży tabelę porównawczą i wskaże najlepszą
            opcję dla Twojego kontekstu.
          </p>
        </section>
      ) : null}
    </main>
  );
}
