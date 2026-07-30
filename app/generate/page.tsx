"use client";

import { FormEvent, useState } from "react";
import { reportGeminiFallback } from "../components/geminiFallbackStatus";

const examples = [
  "Minimalistyczne logo kawiarni w stylu japońskim",
  "Post na Instagram: kawa latte art, ciepłe światło, widok z góry",
  "Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design",
  "Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design",
  "Infografika: 5 kroków do produktywności, pastelowe kolory",
  "Zdjęcie produktowe: elegancki zegarek na ciemnym tle",
];

type GenerateImageResponse = {
  image?: string;
  text?: string;
  error?: string;
};

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [image, setImage] = useState("");
  const [modelText, setModelText] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function generateImage(promptText: string) {
    const cleanPrompt = promptText.trim();

    if (!cleanPrompt || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setImage("");
    setModelText("");
    setLastPrompt(cleanPrompt);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      const data = (await response.json()) as GenerateImageResponse;

      if (!response.ok || !data.image) {
        throw new Error(data.error || "Nie udało się wygenerować obrazu.");
      }

      setImage(data.image);
      setModelText(data.text || "");
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "Nieznany błąd generowania.";

      reportGeminiFallback(message, {
        fallbackModel: "brak automatycznego fallbacku",
        requestedModel: "gemini-3.1-flash-lite-image",
        source: "Grafiki",
      });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    generateImage(prompt);
  }

  function handleDownload() {
    if (!image) {
      return;
    }

    const link = document.createElement("a");
    link.href = image;
    link.download = "ai-generated.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="generate-shell">
      <header className="generate-header">
        <h1>🎨 Generator grafik AI</h1>
        <p>Opisz co chcesz - AI stworzy obraz w kilka sekund</p>
      </header>

      <section className="generator">
        <form className="prompt-form" onSubmit={handleSubmit}>
          <textarea
            aria-label="Opis obrazu"
            disabled={isLoading}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Opisz obraz który chcesz wygenerować..."
            value={prompt}
          />
          <button
            className="generate-button"
            disabled={isLoading || prompt.trim().length === 0}
            type="submit"
          >
            🎨 Generuj
          </button>
        </form>

        <div className="examples" aria-label="Przykładowe prompty">
          {examples.map((example) => (
            <button
              className="example-button"
              disabled={isLoading}
              key={example}
              onClick={() => setPrompt(example)}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="result" aria-live="polite">
        {isLoading && (
          <div className="loading-placeholder">
            Generuję... (5-15 sekund)
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {image && !isLoading && (
          <div className="image-result">
            <img alt={lastPrompt} src={image} />
            {modelText && <p className="model-text">{modelText}</p>}
            <div className="actions">
              <button className="secondary-button" onClick={handleDownload} type="button">
                💾 Pobierz
              </button>
              <button
                className="secondary-button"
                onClick={() => generateImage(lastPrompt)}
                type="button"
              >
                🔄 Ponownie
              </button>
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .generate-shell {
          display: grid;
          grid-template-rows: auto auto auto 1fr;
          gap: 18px;
          min-height: 100vh;
          max-width: 980px;
          margin: 0 auto;
          padding: 32px 18px;
        }

        .generate-header {
          border-bottom: 1px solid #242430;
          padding-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.05;
        }

        .generate-header p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #b8bfd8;
          line-height: 1.55;
        }

        .generator {
          display: grid;
          gap: 16px;
        }

        .prompt-form {
          display: grid;
          gap: 10px;
        }

        textarea {
          width: 100%;
          min-height: 140px;
          resize: vertical;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          color: #ededed;
          padding: 14px;
          font: inherit;
          line-height: 1.5;
          outline: none;
        }

        textarea:focus {
          border-color: #7c8cff;
        }

        .generate-button,
        .example-button,
        .secondary-button {
          transition:
            border-color 160ms ease,
            background 160ms ease,
            color 160ms ease;
        }

        .generate-button {
          justify-self: start;
          min-height: 48px;
          border: 0;
          border-radius: 8px;
          background: #ededed;
          color: #0a0a0a;
          padding: 0 18px;
          font-weight: 800;
        }

        .examples {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .example-button {
          min-height: 48px;
          border: 1px solid #303649;
          border-radius: 8px;
          background: #11151f;
          color: #dce3f6;
          padding: 10px 12px;
          text-align: left;
          font-weight: 700;
          line-height: 1.3;
        }

        .example-button:hover,
        .secondary-button:hover {
          border-color: #7f95ff;
          color: #ffffff;
        }

        .result {
          min-height: 320px;
        }

        .loading-placeholder {
          display: grid;
          min-height: 320px;
          place-items: center;
          border: 1px solid #303649;
          border-radius: 8px;
          background: #11151f;
          color: #dce3f6;
          font-weight: 800;
          animation: pulse 1.4s ease-in-out infinite;
        }

        .error {
          margin: 0;
          color: #ffb4b4;
          line-height: 1.5;
        }

        .image-result {
          display: grid;
          gap: 14px;
        }

        img {
          width: 100%;
          max-height: 760px;
          border: 1px solid #303649;
          border-radius: 8px;
          background: #11151f;
          object-fit: contain;
        }

        .model-text {
          margin: 0;
          color: #cbd2e8;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .secondary-button {
          min-height: 42px;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          color: #ededed;
          padding: 0 14px;
          font-weight: 800;
        }

        button:disabled,
        textarea:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.62;
          }
          50% {
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .generate-shell {
            padding: 22px 14px;
          }

          .examples {
            grid-template-columns: 1fr;
          }

          .generate-button,
          .secondary-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
