"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type KnowledgeDocument = {
  chunks: number;
  created_at: string;
  title: string;
};

type UploadEvent = {
  chunks_saved?: number;
  current?: number;
  error?: string;
  message?: string;
  success?: boolean;
  total?: number;
  type: "progress" | "done" | "error";
};

const examples = [
  {
    label: "Cennik",
    text: "Pakiet Basic: 99 zł/mies. Pakiet Premium: 299 zł/mies. Pakiet VIP: 599 zł/mies. Wszystkie pakiety mają 14-dniowy okres próbny.",
  },
  {
    label: "FAQ",
    text: "Q: Jak mogę anulować subskrypcję? A: Wyślij email na support@firma.pl. Q: Czy wystawiacie faktury? A: Tak, faktura VAT jest wystawiana automatycznie.",
  },
  {
    label: "Regulamin",
    text: "§1. Postanowienia ogólne. 1.1 Niniejszy regulamin określa zasady korzystania z usług. 1.2 Użytkownik akceptuje regulamin podczas rejestracji.",
  },
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nieznana data";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function pluralChunks(value: number) {
  if (value === 1) {
    return "fragment";
  }

  const lastDigit = value % 10;
  const lastTwoDigits = value % 100;

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "fragmenty";
  }

  return "fragmentów";
}

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingTitle, setDeletingTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const progressPercent = useMemo(() => {
    if (progressTotal <= 0) {
      return isUploading ? 12 : 0;
    }

    return Math.min(100, Math.round((progressCurrent / progressTotal) * 100));
  }, [isUploading, progressCurrent, progressTotal]);

  async function loadDocuments() {
    setIsLoadingDocuments(true);
    setError(null);

    try {
      const response = await fetch("/api/upload-knowledge");
      const data = (await response.json()) as {
        documents?: KnowledgeDocument[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się pobrać dokumentów.");
      }

      setDocuments(data.documents ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać dokumentów.",
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDocuments();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function applyExample(exampleTitle: string, exampleText: string) {
    setTitle(exampleTitle);
    setContent(exampleText);
    setError(null);
    setSuccess(null);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent || isUploading) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setProgressCurrent(0);
    setProgressTotal(0);
    setProgressMessage("Przygotowuję dokument...");

    try {
      const response = await fetch("/api/upload-knowledge", {
        body: JSON.stringify({
          content: trimmedContent,
          title: trimmedTitle,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-upload-progress": "stream",
        },
        method: "POST",
      });

      if (!response.body) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Serwer nie zwrócił postępu przetwarzania.");
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
          if (!line.trim()) {
            continue;
          }

          const eventData = JSON.parse(line) as UploadEvent;

          if (eventData.type === "error") {
            throw new Error(eventData.error ?? "Nie udało się zapisać dokumentu.");
          }

          if (eventData.type === "progress") {
            setProgressCurrent(eventData.current ?? 0);
            setProgressTotal(eventData.total ?? 0);
            setProgressMessage(eventData.message ?? "Przetwarzam dokument...");
          }

          if (eventData.type === "done") {
            const chunksSaved = eventData.chunks_saved ?? 0;
            setProgressCurrent(chunksSaved);
            setProgressTotal(chunksSaved);
            setProgressMessage(eventData.message ?? "Zapisano dokument.");
            setSuccess(`✅ Zapisano ${chunksSaved} ${pluralChunks(chunksSaved)}!`);
            setTitle("");
            setContent("");
          }
        }
      }

      await loadDocuments();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Nie udało się zapisać dokumentu.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteDocument(documentTitle: string) {
    const confirmed = window.confirm(
      `Usunąć dokument "${documentTitle}" z bazy wiedzy?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingTitle(documentTitle);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/upload-knowledge", {
        body: JSON.stringify({ title: documentTitle }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się usunąć dokumentu.");
      }

      setDocuments((current) =>
        current.filter((document) => document.title !== documentTitle),
      );
      setSuccess("Dokument usunięty z bazy wiedzy.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nie udało się usunąć dokumentu.",
      );
    } finally {
      setDeletingTitle(null);
    }
  }

  return (
    <main className="upload-shell">
      <header className="upload-header">
        <p className="eyebrow">RAG ingestia</p>
        <h1>📚 Baza wiedzy</h1>
        <p>Wklej tekst — agent będzie z niego korzystał</p>
      </header>

      <section className="upload-layout">
        <form className="upload-form" onSubmit={handleUpload}>
          <label>
            <span>Tytuł dokumentu</span>
            <input
              disabled={isUploading}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
              value={title}
            />
          </label>

          <label>
            <span>Treść dokumentu</span>
            <textarea
              disabled={isUploading}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Wklej tutaj treść dokumentu..."
              value={content}
            />
          </label>

          <div className="example-row" aria-label="Przykładowe dokumenty">
            {examples.map((example) => (
              <button
                disabled={isUploading}
                key={example.label}
                onClick={() => applyExample(example.label, example.text)}
                type="button"
              >
                {example.label}
              </button>
            ))}
          </div>

          {isUploading || progressMessage ? (
            <div className="upload-progress" role="status" aria-live="polite">
              <div className="progress-label">
                <span>{progressMessage || "Gotowe do przetwarzania"}</span>
                <b>{progressPercent}%</b>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {error ? <p className="upload-error">{error}</p> : null}
          {success ? <p className="upload-success">{success}</p> : null}

          <button
            className="upload-submit"
            disabled={isUploading || !title.trim() || !content.trim()}
            type="submit"
          >
            {isUploading ? "Przetwarzam..." : "📤 Zapisz w bazie wiedzy"}
          </button>
        </form>

        <section className="documents-panel" aria-label="Zapisane dokumenty">
          <div className="documents-heading">
            <div>
              <h2>Zapisane dokumenty</h2>
              <p>{documents.length} pozycji w bazie wiedzy</p>
            </div>
            <button disabled={isLoadingDocuments} onClick={() => void loadDocuments()} type="button">
              Odśwież
            </button>
          </div>

          {isLoadingDocuments ? (
            <div className="documents-state">Wczytuję dokumenty...</div>
          ) : documents.length === 0 ? (
            <div className="documents-state">Brak dokumentów. Dodaj pierwszy tekst.</div>
          ) : (
            <div className="documents-list">
              {documents.map((document) => {
                const isDeleting = deletingTitle === document.title;

                return (
                  <article className="document-row" key={document.title}>
                    <div>
                      <h3>{document.title}</h3>
                      <p>
                        {document.chunks} {pluralChunks(document.chunks)} ·{" "}
                        {formatDate(document.created_at)}
                      </p>
                    </div>
                    <button
                      disabled={isDeleting || isUploading}
                      onClick={() => void deleteDocument(document.title)}
                      type="button"
                    >
                      {isDeleting ? "Usuwam..." : "🗑️ Usuń"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        .upload-shell {
          width: min(1120px, calc(100% - 1.5rem));
          margin: 0 auto;
          padding: 2rem 0 3rem;
        }

        .upload-header {
          margin-bottom: 1.4rem;
        }

        .upload-header h1 {
          margin: 0;
          font-size: clamp(1.8rem, 4.5vw, 2.8rem);
          line-height: 1.1;
        }

        .upload-header p:not(.eyebrow) {
          margin: 0.55rem 0 0;
          color: var(--muted);
          line-height: 1.55;
        }

        .upload-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
          gap: 1rem;
          align-items: start;
        }

        .upload-form,
        .documents-panel {
          border: 1px solid #2d3444;
          border-radius: 8px;
          background: rgba(17, 19, 26, 0.9);
          padding: 1rem;
        }

        .upload-form {
          display: grid;
          gap: 0.9rem;
        }

        label {
          display: grid;
          gap: 0.4rem;
          color: #dce3f6;
          font-size: 0.82rem;
          font-weight: 800;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #0f111a;
          color: var(--text);
          outline: none;
        }

        input {
          min-height: 44px;
          padding: 0 0.85rem;
        }

        textarea {
          min-height: 300px;
          resize: vertical;
          padding: 0.85rem;
          line-height: 1.55;
        }

        input:focus,
        textarea:focus {
          border-color: #58a6ff;
          box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.14);
        }

        input:disabled,
        textarea:disabled,
        button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .example-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .example-row button,
        .documents-heading button,
        .document-row button {
          min-height: 34px;
          border: 1px solid #334054;
          border-radius: 7px;
          padding: 0.45rem 0.7rem;
          background: #121722;
          color: #e5edf8;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
        }

        .example-row button:hover:not(:disabled),
        .documents-heading button:hover:not(:disabled) {
          border-color: #58a6ff;
        }

        .upload-progress {
          border: 1px solid #2e4054;
          border-radius: 8px;
          padding: 0.85rem;
          background: #101722;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          color: #b7c5dd;
          font-size: 0.82rem;
        }

        .progress-label b {
          color: #ffffff;
        }

        .upload-submit {
          min-height: 46px;
          border: 1px solid #57b48e;
          border-radius: 8px;
          background: linear-gradient(135deg, #58a6ff, #72e6ac);
          color: #061018;
          font-weight: 900;
          cursor: pointer;
        }

        .upload-error,
        .upload-success {
          margin: 0;
          border-radius: 8px;
          padding: 0.75rem 0.85rem;
          line-height: 1.45;
        }

        .upload-error {
          border: 1px solid #7f3540;
          background: #251119;
          color: #ffc7cc;
        }

        .upload-success {
          border: 1px solid #57b48e;
          background: #13291f;
          color: #c7f8dc;
        }

        .documents-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          margin-bottom: 1rem;
        }

        .documents-heading h2 {
          margin: 0;
          font-size: 1.05rem;
        }

        .documents-heading p {
          margin: 0.25rem 0 0;
          color: var(--muted);
          font-size: 0.8rem;
        }

        .documents-list {
          display: grid;
          gap: 0.65rem;
        }

        .document-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          border: 1px solid #303649;
          border-radius: 8px;
          padding: 0.85rem;
          background: #11151f;
        }

        .document-row h3 {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .document-row p {
          margin: 0.35rem 0 0;
          color: var(--muted);
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .document-row button {
          flex: 0 0 auto;
          border-color: #5a3038;
          background: #1f1118;
          color: #ffc7cc;
        }

        .document-row button:hover:not(:disabled) {
          border-color: var(--danger);
          background: #2b121b;
        }

        .documents-state {
          display: grid;
          min-height: 220px;
          place-items: center;
          border: 1px dashed #354054;
          border-radius: 8px;
          color: var(--muted);
          text-align: center;
        }

        @media (max-width: 900px) {
          .upload-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .documents-heading,
          .document-row {
            align-items: stretch;
            flex-direction: column;
          }

          .documents-heading button,
          .document-row button {
            align-self: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
