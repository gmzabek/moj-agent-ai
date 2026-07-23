"use client";

import { useEffect, useState } from "react";
import {
  AttachmentPreview,
  ImageFileInput,
  useImageAttachment,
} from "../components/imageAttachment";
import { MarkdownView } from "../components/MarkdownView";

type StreamChunk =
  | { type: "text-delta"; delta: string }
  | { type: "error"; errorText?: string }
  | { type: string; [key: string]: unknown };

type GenerateImageResponse = {
  image?: string;
  text?: string;
  error?: string;
};

const questions = [
  "Co widzisz na tym obrazie?",
  "Wyciągnij cały tekst z tego screena",
  "Opisz to w 3 zdaniach",
  "Jakie kolory dominują? Podaj kody HEX",
  "Wygeneruj podobny obraz w innym stylu",
];

function toApiMessages(prompt: string) {
  return [
    {
      id: `vision-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: prompt }],
    },
  ];
}

async function readChatResponse(response: Response) {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (!response.body) {
    throw new Error("Brak treści odpowiedzi z API.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

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
        text += String(chunk.delta ?? "");
      }

      if (chunk.type === "error") {
        throw new Error(String(chunk.errorText || "Nieznany błąd po stronie API."));
      }
    }
  }

  return text;
}

export default function VisionPage() {
  const imageAttachment = useImageAttachment();
  const { pickImage } = imageAttachment;
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    function handleWindowPaste(event: ClipboardEvent) {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find(
        (item) => item.type.startsWith("image/"),
      );

      if (!imageItem) {
        return;
      }

      event.preventDefault();
      void pickImage(imageItem.getAsFile());
    }

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [pickImage]);

  async function askVision(prompt: string) {
    if (!imageAttachment.attachedImage) {
      return "";
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image: imageAttachment.attachedImage.dataUrl,
        messages: toApiMessages(prompt),
        model: "flash",
      }),
    });

    return readChatResponse(response);
  }

  async function generateFromVision(promptText: string) {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: promptText }),
    });
    const data = (await response.json()) as GenerateImageResponse;

    if (!response.ok || !data.image) {
      throw new Error(data.error || "Nie udało się wygenerować obrazu.");
    }

    setGeneratedImage(data.image);
    setGeneratedText(data.text || "");
  }

  async function runQuestion(promptText: string) {
    const cleanPrompt = promptText.trim();

    if (!cleanPrompt || !imageAttachment.attachedImage || isLoading) {
      return;
    }

    setQuestion(cleanPrompt);
    setAnswer("");
    setGeneratedImage("");
    setGeneratedText("");
    setError("");
    setIsLoading(true);

    try {
      if (cleanPrompt === questions[4]) {
        const imagePrompt = await askVision(
          "Przeanalizuj obraz i przygotuj szczegółowy prompt do generatora grafiki. Zachowaj kompozycję i główny temat, ale opisz wersję w innym, ciekawym stylu. Zwróć tylko prompt.",
        );
        setAnswer(imagePrompt);
        await generateFromVision(imagePrompt);
      } else {
        setAnswer(await askVision(cleanPrompt));
      }
    } catch (visionError) {
      setError(
        visionError instanceof Error ? visionError.message : "Nieznany błąd.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className="vision-shell"
      onDragLeave={imageAttachment.handleDragLeave}
      onDragOver={imageAttachment.handleDragOver}
      onDrop={imageAttachment.handleDrop}
    >
      {imageAttachment.isDraggingImage && (
        <div className="drop-overlay">Upuść obraz tutaj</div>
      )}

      <header className="vision-header">
        <h1>👁️ Agent Vision</h1>
        <p>Wklej screenshot, wrzuć plik lub przeciągnij obraz</p>
      </header>

      {!imageAttachment.attachedImage ? (
        <button
          className="paste-zone"
          onClick={imageAttachment.openFilePicker}
          type="button"
        >
          <span>📸 Ctrl+V - wklej screenshot</span>
          <span>📁 Kliknij - wybierz plik</span>
          <span>🖱️ Przeciągnij - upuść obraz</span>
        </button>
      ) : (
        <section className="vision-workspace">
          <AttachmentPreview
            image={imageAttachment.attachedImage}
            onRemove={imageAttachment.clearImage}
          />

          <div className="question-panel">
            <input
              aria-label="Pytanie o obraz"
              disabled={isLoading}
              onChange={(event) => setQuestion(event.target.value)}
              onPaste={imageAttachment.handlePaste}
              placeholder="Zadaj pytanie o obraz..."
              value={question}
            />
            <button
              className="primary-button"
              disabled={isLoading || question.trim().length === 0}
              onClick={() => runQuestion(question)}
              type="button"
            >
              Analizuj
            </button>
          </div>

          <div className="quick-questions" aria-label="Pytania">
            {questions.map((item) => (
              <button
                disabled={isLoading}
                key={item}
                onClick={() => runQuestion(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      <ImageFileInput
        fileInputRef={imageAttachment.fileInputRef}
        onChange={imageAttachment.handleFileInput}
      />

      {imageAttachment.imageError && (
        <p className="error">{imageAttachment.imageError}</p>
      )}
      {isLoading && <p className="status">Analizuję obraz...</p>}
      {error && <p className="error">{error}</p>}

      {(answer || generatedImage) && (
        <section className="result">
          {answer && <MarkdownView text={answer} />}

          {generatedImage && imageAttachment.attachedImage && (
            <div className="comparison">
              <figure>
                <img alt="Oryginalny obraz" src={imageAttachment.attachedImage.dataUrl} />
                <figcaption>Oryginał</figcaption>
              </figure>
              <figure>
                <img alt="Wygenerowana wersja" src={generatedImage} />
                <figcaption>Nowa wersja</figcaption>
              </figure>
            </div>
          )}

          {generatedText && <p className="generated-text">{generatedText}</p>}
        </section>
      )}

      <style jsx>{`
        .vision-shell {
          display: grid;
          gap: 18px;
          min-height: 100vh;
          max-width: 980px;
          margin: 0 auto;
          padding: 32px 18px;
          position: relative;
        }

        .drop-overlay {
          position: fixed;
          inset: 18px;
          z-index: 20;
          display: grid;
          place-items: center;
          border: 2px dashed #9fb2ff;
          border-radius: 8px;
          background: rgba(10, 12, 20, 0.88);
          color: #ffffff;
          font-size: 1.4rem;
          font-weight: 900;
        }

        .vision-header {
          border-bottom: 1px solid #242430;
          padding-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.05;
        }

        .vision-header p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #b8bfd8;
          line-height: 1.55;
        }

        .paste-zone {
          display: grid;
          gap: 14px;
          min-height: 320px;
          place-items: center;
          border: 2px dashed #3a4056;
          border-radius: 8px;
          background: #11151f;
          color: #dce3f6;
          padding: 28px;
          font-size: 1.08rem;
          font-weight: 900;
        }

        .paste-zone:hover,
        .quick-questions button:hover,
        .primary-button:hover {
          border-color: #9fb2ff;
        }

        .vision-workspace,
        .question-panel,
        .result {
          display: grid;
          gap: 14px;
        }

        .question-panel {
          grid-template-columns: 1fr auto;
        }

        input {
          width: 100%;
          min-height: 48px;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          color: #ededed;
          padding: 0 14px;
          outline: none;
        }

        input:focus {
          border-color: #7c8cff;
        }

        .primary-button,
        .quick-questions button {
          min-height: 48px;
          border-radius: 8px;
          font-weight: 800;
        }

        .primary-button {
          border: 0;
          background: #ededed;
          color: #0a0a0a;
          padding: 0 18px;
        }

        .quick-questions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .quick-questions button {
          border: 1px solid #303649;
          background: #11151f;
          color: #dce3f6;
          padding: 10px 12px;
          text-align: left;
          line-height: 1.3;
        }

        .status {
          margin: 0;
          color: #a6adc8;
        }

        .error {
          margin: 0;
          color: #ffb4b4;
          line-height: 1.5;
        }

        .result {
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          padding: 16px;
          line-height: 1.55;
        }

        .comparison {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        figure {
          display: grid;
          gap: 8px;
          margin: 0;
        }

        img {
          width: 100%;
          max-height: 560px;
          border: 1px solid #303649;
          border-radius: 8px;
          background: #05070d;
          object-fit: contain;
        }

        figcaption,
        .generated-text {
          margin: 0;
          color: #aeb7d3;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        @media (max-width: 700px) {
          .vision-shell {
            padding: 22px 14px;
          }

          .question-panel,
          .quick-questions,
          .comparison {
            grid-template-columns: 1fr;
          }

          .primary-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
