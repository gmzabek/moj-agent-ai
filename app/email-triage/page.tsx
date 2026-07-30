"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import styles from "./EmailTriage.module.css";

type Priority = "high" | "medium" | "low" | "pending";

type TriageCard = {
  category: string;
  draft: string;
  number: number;
  priority: Priority;
  priorityLabel: string;
  reason: string;
  subject: string;
};

const exampleEmails = `Mail 1 - PILNY:
Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł, a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.

Mail 2 - SPAM:
Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Mail 3 - OFERTA:
Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Mail 4 - REKLAMACJA:
Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło, ale nie dostaję maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.

Mail 5 - INFO:
Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.`;

function extractTableValue(section: string, field: string) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(
    new RegExp(`\\|\\s*${escapedField}\\s*\\|\\s*([^|\\n]+)`, "i"),
  );

  return match?.[1]?.trim() ?? "";
}

function getPriority(value: string): Priority {
  const normalized = value.toLocaleLowerCase("pl");

  if (normalized.includes("wysoki")) {
    return "high";
  }

  if (normalized.includes("średni") || normalized.includes("sredni")) {
    return "medium";
  }

  if (normalized.includes("niski")) {
    return "low";
  }

  return "pending";
}

function extractDraft(section: string) {
  const marker = section.search(/\*\*Proponowana odpowiedź:\*\*/i);

  if (marker < 0) {
    return "";
  }

  return section
    .slice(marker)
    .replace(/^\*\*Proponowana odpowiedź:\*\*\s*/i, "")
    .split(/\n---|\n##\s+/)[0]
    .split("\n")
    .map((line) => line.replace(/^\s*>\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parseAnalysis(text: string) {
  const headerPattern = /^###\s+Mail\s+(\d+)\s*:\s*(.*)$/gim;
  const headers: Array<{
    index: number;
    number: number;
    subject: string;
  }> = [];
  let match: RegExpExecArray | null;

  while ((match = headerPattern.exec(text)) !== null) {
    headers.push({
      index: match.index,
      number: Number(match[1]),
      subject: match[2].trim(),
    });
  }

  const summaryIndex = text.search(/^##\s+PODSUMOWANIE/im);
  const cards = headers.map((header, index): TriageCard => {
    const nextHeaderIndex = headers[index + 1]?.index ?? text.length;
    const end =
      summaryIndex > header.index
        ? Math.min(nextHeaderIndex, summaryIndex)
        : nextHeaderIndex;
    const section = text.slice(header.index, end);
    const priorityLabel = extractTableValue(section, "Priorytet");

    return {
      category: extractTableValue(section, "Kategoria"),
      draft: extractDraft(section),
      number: header.number,
      priority: getPriority(priorityLabel),
      priorityLabel,
      reason: extractTableValue(section, "Uzasadnienie"),
      subject: header.subject || "Analizuję temat…",
    };
  });
  const recommendationMatch = text.match(
    /[-*]\s*✅\s*Rekomendacja:\s*(.+?)(?:\n|$)/i,
  );

  return {
    cards,
    recommendation: recommendationMatch?.[1]?.trim() ?? "",
  };
}

function splitEmails(value: string) {
  const normalized = value.trim().replace(/\r\n/g, "\n");

  if (!normalized) {
    return [];
  }

  const splitByLabels = normalized
    .split(/\n\s*\n(?=Mail\s+\d+\s*[-:])/i)
    .map((email) => email.trim())
    .filter(Boolean);

  if (splitByLabels.length > 1) {
    return splitByLabels;
  }

  return normalized
    .split(/\n\s*\n+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

async function writeToClipboard(text: string) {
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

function isNoReplyDraft(draft: string) {
  return /^brak odpowiedzi\b/i.test(draft);
}

export default function EmailTriagePage() {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMail, setCopiedMail] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const parsed = useMemo(() => parseAnalysis(analysis), [analysis]);
  const counts = useMemo(() => {
    return parsed.cards.reduce(
      (result, card) => {
        const isSpam = card.category.toLocaleLowerCase("pl").includes("spam");

        if (isSpam) {
          result.spam += 1;
        } else if (card.priority === "high") {
          result.high += 1;
        } else if (card.priority === "medium") {
          result.medium += 1;
        } else if (card.priority === "low") {
          result.low += 1;
        }

        return result;
      },
      { high: 0, low: 0, medium: 0, spam: 0 },
    );
  }, [parsed.cards]);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  async function analyzeEmails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emails = splitEmails(input);

    if (emails.length === 0 || isLoading) {
      return;
    }

    if (emails.length > 20) {
      setError("Możesz przeanalizować maksymalnie 20 maili naraz.");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setError("");
    setAnalysis("");
    setCopiedMail(null);

    try {
      const response = await authenticatedFetch("/api/email-triage", {
        body: JSON.stringify({ emails }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(data?.error || "Nie udało się przeanalizować maili.");
      }

      if (!response.body) {
        throw new Error("Serwer nie zwrócił strumienia odpowiedzi.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let completeText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          completeText += decoder.decode();
          setAnalysis(completeText);
          break;
        }

        completeText += decoder.decode(value, { stream: true });
        setAnalysis(completeText);
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się przeanalizować maili.",
      );
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsLoading(false);
      }
    }
  }

  async function copyDraft(card: TriageCard) {
    try {
      await writeToClipboard(card.draft);
      setCopiedMail(card.number);
      window.setTimeout(() => setCopiedMail(null), 1800);
    } catch {
      setError("Nie udało się skopiować draftu. Zaznacz tekst i skopiuj go ręcznie.");
    }
  }

  const hasCards = parsed.cards.length > 0;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>AGENT DO ZADAŃ</span>
        <h1>📧 E-mail Triage</h1>
        <p>Wklej maile — agent posortuje i napisze odpowiedzi</p>
      </header>

      <form className={styles.composer} onSubmit={analyzeEmails}>
        <div className={styles.composerHeader}>
          <div>
            <h2>Skrzynka do analizy</h2>
            <p>Oddziel kolejne wiadomości pustą linią.</p>
          </div>
          <button
            className={styles.exampleButton}
            disabled={isLoading}
            onClick={() => {
              setInput(exampleEmails);
              setError("");
            }}
            type="button"
          >
            📋 Wklej przykład
          </button>
        </div>

        <label className={styles.textareaLabel}>
          <span>Treść maili</span>
          <textarea
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wklej maile tutaj — oddziel je pustą linią..."
            value={input}
          />
        </label>

        <div className={styles.formFooter}>
          <span>
            {splitEmails(input).length > 0
              ? `Wykryto wiadomości: ${splitEmails(input).length}`
              : "Możesz wkleić do 20 wiadomości"}
          </span>
          <button
            className={styles.analyzeButton}
            disabled={isLoading || !input.trim()}
            type="submit"
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Analizuję…
              </>
            ) : (
              "📧 Analizuj maile"
            )}
          </button>
        </div>
      </form>

      {error ? (
        <div className={styles.error} role="alert">
          <strong>Nie udało się zakończyć analizy.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {(hasCards || isLoading) && (
        <section className={styles.results} aria-live="polite">
          <div className={styles.summary}>
            <div className={styles.summaryHeading}>
              <div>
                <span>PODSUMOWANIE</span>
                <h2>
                  {hasCards
                    ? `${counts.high} pilne, ${counts.medium} średnie, ${counts.low} niskie, ${counts.spam} spam`
                    : "Agent czyta wiadomości…"}
                </h2>
              </div>
              {isLoading ? (
                <span className={styles.liveBadge}>● analiza na żywo</span>
              ) : (
                <span className={styles.doneBadge}>✓ gotowe</span>
              )}
            </div>

            <div className={styles.metrics}>
              <div className={styles.highMetric}>
                <span>🔴</span>
                <strong>{hasCards ? counts.high : "—"}</strong>
                <small>Pilne</small>
              </div>
              <div className={styles.mediumMetric}>
                <span>🟡</span>
                <strong>{hasCards ? counts.medium : "—"}</strong>
                <small>Średnie</small>
              </div>
              <div className={styles.lowMetric}>
                <span>🟢</span>
                <strong>{hasCards ? counts.low : "—"}</strong>
                <small>Niskie</small>
              </div>
              <div className={styles.spamMetric}>
                <span>🗑️</span>
                <strong>{hasCards ? counts.spam : "—"}</strong>
                <small>Spam</small>
              </div>
            </div>

            {parsed.recommendation ? (
              <p className={styles.recommendation}>
                <span aria-hidden="true">⚡</span>
                <span>
                  <strong>Rekomendacja</strong>
                  {parsed.recommendation}
                </span>
              </p>
            ) : null}
          </div>

          <div className={styles.cardList}>
            {parsed.cards.map((card) => {
              const spam = card.category.toLocaleLowerCase("pl").includes("spam");
              const priorityClass = spam ? styles.spam : styles[card.priority];
              const noReply = isNoReplyDraft(card.draft);

              return (
                <article
                  className={`${styles.mailCard} ${priorityClass}`}
                  key={card.number}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.mailTitle}>
                      <span>MAIL {card.number}</span>
                      <h3>{card.subject}</h3>
                    </div>
                    <span className={styles.priorityPill}>
                      {spam ? "🗑️ Spam" : card.priorityLabel || "Analizuję…"}
                    </span>
                  </div>

                  <dl className={styles.details}>
                    <div>
                      <dt>Kategoria</dt>
                      <dd>{card.category || "Analizuję…"}</dd>
                    </div>
                    <div>
                      <dt>Uzasadnienie</dt>
                      <dd>{card.reason || "Agent ustala priorytet…"}</dd>
                    </div>
                  </dl>

                  {card.draft ? (
                    <div className={styles.draft}>
                      <div className={styles.draftHeader}>
                        <span>{noReply ? "DECYZJA" : "PROPONOWANA ODPOWIEDŹ"}</span>
                        {!noReply ? (
                          <button
                            onClick={() => void copyDraft(card)}
                            type="button"
                          >
                            {copiedMail === card.number ? "✓ Skopiowano" : "Kopiuj draft"}
                          </button>
                        ) : null}
                      </div>
                      <blockquote>{card.draft}</blockquote>
                    </div>
                  ) : (
                    <div className={styles.draftSkeleton}>
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
