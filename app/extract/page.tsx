"use client";

import { FormEvent, useState } from "react";
import { reportGeminiFallback } from "../components/geminiFallbackStatus";
import { MarkdownView } from "../components/MarkdownView";

type StreamChunk =
  | { type: "text-delta"; delta: string }
  | { type: "error"; errorText?: string }
  | { type: string; [key: string]: unknown };

const examples = [
  "Wyciągnij z tekstu: firmy, osoby, kwoty, daty i zadania do wykonania.",
  "Zamień ten opis procesu na listę kroków i tabelę ryzyk.",
  "Znajdź dane liczbowe i policz najważniejsze wskaźniki.",
];

async function readChatResponse(response: Response, onDelta: (delta: string) => void) {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error("Brak treści odpowiedzi z API.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }

      const data = line.slice(6).trim();

      if (!data || data === "[DONE]") {
        continue;
      }

      const chunk = JSON.parse(data) as StreamChunk;

      if (chunk.type === "text-delta") {
        onDelta(String(chunk.delta ?? ""));
      }

      if (chunk.type === "error") {
        throw new Error(String(chunk.errorText || "Nieznany błąd po stronie API."));
      }
    }
  }
}

export default function ExtractPage() {
  const [instruction, setInstruction] = useState(examples[0]);
  const [source, setSource] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function analyze() {
    if (!source.trim() || isLoading) {
      return;
    }

    setAnswer("");
    setError("");
    setIsLoading(true);

    try {
      let nextAnswer = "";
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "flash",
          messages: [
            {
              id: `extract-${Date.now()}`,
              role: "user",
              parts: [
                {
                  type: "text",
                  text: `${instruction}\n\nTekst do analizy:\n${source}`,
                },
              ],
            },
          ],
        }),
      });

      await readChatResponse(response, (delta) => {
        nextAnswer += delta;
        setAnswer((current) => `${current}${delta}`);
      });
      reportGeminiFallback(nextAnswer, {
        fallbackModel: "brak automatycznego fallbacku",
        requestedModel: "gemini-3.1-flash-lite",
        source: "Analizator",
      });
    } catch (extractError) {
      const message =
        extractError instanceof Error ? extractError.message : "Nieznany błąd.";

      reportGeminiFallback(message, {
        fallbackModel: "brak automatycznego fallbacku",
        requestedModel: "gemini-3.1-flash-lite",
        source: "Analizator",
      });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    analyze();
  }

  return (
    <main className="extract-shell">
      <header className="extract-header">
        <h1>📊 Analizator</h1>
        <p>Wklej tekst, dane albo opis procesu i wyciągnij z niego strukturę.</p>
      </header>

      <section className="examples" aria-label="Przykłady">
        {examples.map((example) => (
          <button
            disabled={isLoading}
            key={example}
            onClick={() => setInstruction(example)}
            type="button"
          >
            {example}
          </button>
        ))}
      </section>

      <form className="analyzer" onSubmit={handleSubmit}>
        <input
          aria-label="Instrukcja analizy"
          disabled={isLoading}
          onChange={(event) => setInstruction(event.target.value)}
          value={instruction}
        />
        <textarea
          aria-label="Tekst do analizy"
          disabled={isLoading}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Wklej tutaj tekst, notatkę, dane albo opis procesu..."
          value={source}
        />
        <button disabled={isLoading || source.trim().length === 0} type="submit">
          Analizuj
        </button>
      </form>

      {isLoading && <p className="status">Analizuję...</p>}
      {error && <p className="error">{error}</p>}
      {answer && (
        <section className="result">
          <MarkdownView text={answer} />
        </section>
      )}

      <style jsx>{`
        .extract-shell {
          display: grid;
          gap: 18px;
          min-height: 100vh;
          max-width: 980px;
          margin: 0 auto;
          padding: 32px 18px;
        }

        .extract-header {
          border-bottom: 1px solid #242430;
          padding-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.05;
        }

        .extract-header p,
        .status {
          margin: 12px 0 0;
          color: #b8bfd8;
        }

        .examples {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .examples button,
        .analyzer button {
          min-height: 48px;
          border-radius: 8px;
          font-weight: 800;
        }

        .examples button {
          border: 1px solid #303649;
          background: #11151f;
          color: #dce3f6;
          padding: 10px 12px;
          text-align: left;
        }

        .analyzer {
          display: grid;
          gap: 10px;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          color: #ededed;
          padding: 12px 14px;
          font: inherit;
          outline: none;
        }

        input {
          min-height: 48px;
        }

        textarea {
          min-height: 220px;
          resize: vertical;
          line-height: 1.5;
        }

        input:focus,
        textarea:focus {
          border-color: #7c8cff;
        }

        .analyzer button {
          justify-self: start;
          border: 0;
          background: #ededed;
          color: #0a0a0a;
          padding: 0 18px;
        }

        .result {
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          padding: 16px;
        }

        .error {
          margin: 0;
          color: #ffb4b4;
        }

        button:disabled,
        input:disabled,
        textarea:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        @media (max-width: 760px) {
          .extract-shell {
            padding: 22px 14px;
          }

          .examples {
            grid-template-columns: 1fr;
          }

          .analyzer button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
