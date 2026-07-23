"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type KnowledgeChunk = {
  content: string;
  created_at: string | null;
  id: string;
  metadata: Record<string, unknown>;
  order: number;
};

type KnowledgeDocument = {
  chunks: KnowledgeChunk[];
  created_at: string | null;
  title: string;
};

type KnowledgeSearchResult = {
  added_at: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  title: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Brak daty";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Brak daty";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSimilarity(value: number) {
  return `${Math.round(value * 100)}%`;
}

function fragmentLabel(count: number) {
  if (count === 1) return "1 fragment";
  if (count >= 2 && count <= 4) return `${count} fragmenty`;
  return `${count} fragmentów`;
}

function fragmentNoun(count: number) {
  if (count === 1) return "fragment";
  if (count >= 2 && count <= 4) return "fragmenty";
  return "fragmentów";
}

function documentNoun(count: number) {
  if (count === 1) return "dokument";
  if (count >= 2 && count <= 4) return "dokumenty";
  return "dokumentów";
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.title === selectedTitle) ?? documents[0],
    [documents, selectedTitle],
  );
  const fragmentCount = documents.reduce(
    (sum, document) => sum + document.chunks.length,
    0,
  );

  async function loadKnowledge() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/knowledge");
      const data = (await response.json()) as {
        documents?: KnowledgeDocument[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się pobrać bazy wiedzy.");
      }

      const nextDocuments = data.documents ?? [];
      const requestedTitle =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search).get("document");
      setDocuments(nextDocuments);
      setSelectedTitle((current) =>
        requestedTitle &&
        nextDocuments.some((document) => document.title === requestedTitle)
          ? requestedTitle
          : current && nextDocuments.some((document) => document.title === current)
            ? current
            : nextDocuments[0]?.title ?? null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać bazy wiedzy.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadKnowledge();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function selectDocument(title: string, scrollToPreview = false) {
    setSelectedTitle(title);

    const url = new URL(window.location.href);
    url.searchParams.set("document", title);
    window.history.replaceState({}, "", url);

    if (scrollToPreview) {
      window.requestAnimationFrame(() => {
        document.getElementById("document-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery || isSearching) {
      return;
    }

    setHasSearched(true);
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch("/api/search-knowledge", {
        body: JSON.stringify({ query: trimmedQuery }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        results?: KnowledgeSearchResult[];
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się przeszukać bazy wiedzy.");
      }

      setSearchResults(data.results ?? []);
    } catch (searchFailure) {
      setSearchError(
        searchFailure instanceof Error
          ? searchFailure.message
          : "Nie udało się przeszukać bazy wiedzy.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="knowledge-shell">
      <header className="knowledge-header">
        <div className="title-group">
          <span aria-hidden="true" className="knowledge-mark">◎</span>
          <div>
            <p className="eyebrow">Baza wiedzy</p>
            <h1>Dokumenty agenta</h1>
            <p className="header-copy">
              Treści, na których agent opiera odpowiedzi i cytowane źródła.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="knowledge-stats" aria-label="Stan bazy wiedzy">
            <span><strong>{documents.length}</strong> {documentNoun(documents.length)}</span>
            <span><strong>{fragmentCount}</strong> {fragmentNoun(fragmentCount)}</span>
          </div>
          <button
            aria-label="Odśwież bazę wiedzy"
            className="icon-button"
            disabled={isLoading}
            onClick={() => void loadKnowledge()}
            title="Odśwież"
            type="button"
          >
            <span aria-hidden="true">↻</span>
          </button>
          <Link href="/upload">
            <span className="add-document">
              <span aria-hidden="true">+</span>
              Dodaj dokument
            </span>
          </Link>
        </div>
      </header>

      {error ? <p className="knowledge-error" role="alert">{error}</p> : null}

      <section className="search-panel" aria-labelledby="search-title">
        <div className="search-heading">
          <div>
            <p className="section-label">Test wyszukiwania semantycznego</p>
            <h2 id="search-title">Sprawdź, co znajdzie agent</h2>
          </div>
          {hasSearched && !isSearching && !searchError ? (
            <span className="result-count">{searchResults.length} wyników</span>
          ) : null}
        </div>

        <form className="knowledge-search" onSubmit={handleSearch}>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Pytanie testowe"
              disabled={isSearching}
              onChange={(event) => {
                setQuery(event.target.value);
                if (hasSearched) setHasSearched(false);
              }}
              placeholder="Np. jaki sejf wybrać do biura?"
              value={query}
            />
          </label>
          <button disabled={isSearching || query.trim().length === 0} type="submit">
            {isSearching ? "Szukam..." : "Szukaj"}
          </button>
        </form>

        {searchError ? <p className="knowledge-error search-error" role="alert">{searchError}</p> : null}

        {hasSearched && !isSearching && searchResults.length === 0 && !searchError ? (
          <div className="empty-search">
            <strong>Brak pasujących fragmentów</strong>
            <span>Spróbuj użyć innych słów lub bardziej ogólnego pytania.</span>
          </div>
        ) : null}

        {hasSearched && searchResults.length > 0 ? (
          <div className="result-list" aria-live="polite">
            {searchResults.map((result, index) => (
              <article className="result-row" key={`${result.title}-${index}`}>
                <div className="result-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="result-content">
                  <div className="result-meta">
                    <strong>{result.title}</strong>
                    <span className={result.similarity >= 0.5 ? "match good" : "match"}>
                      {formatSimilarity(result.similarity)} dopasowania
                    </span>
                  </div>
                  <p>{result.content}</p>
                  <div className="result-footer">
                    <span>Dodano {formatDate(result.added_at)}</span>
                    {documents.some((document) => document.title === result.title) ? (
                      <button onClick={() => selectDocument(result.title, true)} type="button">
                        Pokaż w dokumencie <span aria-hidden="true">↓</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="knowledge-workspace" id="document-preview">
        <aside className="document-list" aria-label="Dokumenty">
          <div className="list-heading">
            <div>
              <p className="section-label">Dokumenty</p>
              <h2>Źródła agenta</h2>
            </div>
            <span>{documents.length}</span>
          </div>

          <div className="document-items">
            {isLoading ? (
              <div className="state"><span className="loader" />Wczytuję dokumenty...</div>
            ) : documents.length === 0 ? (
              <div className="state">Brak dokumentów w bazie wiedzy.</div>
            ) : (
              documents.map((document) => {
                const isActive = document.title === selectedDocument?.title;

                return (
                  <button
                    aria-pressed={isActive}
                    className={isActive ? "active" : ""}
                    key={document.title}
                    onClick={() => selectDocument(document.title)}
                    type="button"
                  >
                    <span aria-hidden="true" className="document-icon">▤</span>
                    <span className="document-copy">
                      <strong>{document.title}</strong>
                      <small>{fragmentLabel(document.chunks.length)} · {formatDate(document.created_at)}</small>
                    </span>
                    <span aria-hidden="true" className="chevron">›</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="preview-panel" aria-label="Podgląd fragmentów">
          <div className="preview-heading">
            <div>
              <p className="section-label">Fragmenty dokumentu</p>
              <h2>{selectedDocument?.title ?? "Wybierz dokument"}</h2>
            </div>
            {selectedDocument ? (
              <div className="document-summary">
                <strong>{selectedDocument.chunks.length}</strong>
                <span>{fragmentLabel(selectedDocument.chunks.length)}</span>
              </div>
            ) : null}
          </div>

          {selectedDocument ? (
            <div className="chunk-list">
              {selectedDocument.chunks.map((chunk, index) => (
                <article className="chunk-row" key={chunk.id}>
                  <div className="chunk-number">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="chunk-meta">
                      <strong>Fragment {index + 1}</strong>
                      <span>{formatDate(chunk.created_at)}</span>
                    </div>
                    <p>{chunk.content}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="preview-empty">Wybierz dokument z listy, aby zobaczyć jego treść.</div>
          )}
        </section>
      </section>

      <style jsx>{`
        .knowledge-shell {
          width: min(1180px, calc(100% - 2rem));
          margin: 0 auto;
          padding: 2rem 0 4rem;
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        .knowledge-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        }

        .title-group,
        .header-actions,
        .knowledge-stats,
        .search-heading,
        .result-meta,
        .result-footer,
        .list-heading,
        .preview-heading,
        .chunk-meta {
          display: flex;
          align-items: center;
        }

        .title-group {
          gap: 1rem;
          min-width: 0;
        }

        .knowledge-mark {
          display: grid;
          width: 46px;
          height: 46px;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid rgba(132, 232, 178, 0.25);
          border-radius: 8px;
          background: #111b18;
          color: #8aebba;
          font-size: 1.8rem;
          line-height: 1;
        }

        .eyebrow,
        .section-label {
          color: #8ee7b8;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        h1 {
          margin-top: 0.25rem;
          color: #f8fafc;
          font-size: clamp(1.8rem, 3.2vw, 2.55rem);
          font-weight: 760;
          line-height: 1.08;
        }

        h2 {
          color: #f5f7fb;
          font-size: 1rem;
          line-height: 1.25;
        }

        .header-copy {
          margin-top: 0.4rem;
          color: #929bad;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .header-actions {
          flex: 0 0 auto;
          gap: 0.55rem;
        }

        .knowledge-stats {
          gap: 1rem;
          margin-right: 0.4rem;
          padding-right: 1rem;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .knowledge-stats span {
          display: grid;
          gap: 0.05rem;
          color: #858fa2;
          font-size: 0.68rem;
          line-height: 1.1;
        }

        .knowledge-stats strong {
          color: #f4f7fb;
          font-size: 1rem;
          font-weight: 760;
        }

        .icon-button,
        .add-document,
        .knowledge-search button {
          display: inline-flex;
          min-height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          cursor: pointer;
          font-weight: 750;
          transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
        }

        .icon-button {
          width: 40px;
          border: 1px solid #303746;
          background: #12151c;
          color: #c7cfdd;
          font-size: 1.1rem;
        }

        .icon-button:hover:not(:disabled) {
          border-color: #667085;
          background: #181c25;
          color: #ffffff;
        }

        .add-document {
          gap: 0.45rem;
          border: 1px solid rgba(120, 225, 168, 0.45);
          padding: 0 0.85rem;
          background: #13251d;
          color: #e8fff2;
          font-size: 0.78rem;
        }

        .add-document:hover {
          border-color: #80e7ae;
          background: #183124;
        }

        .add-document span {
          color: #87ecb5;
          font-size: 1.1rem;
          font-weight: 500;
        }

        button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .search-panel {
          margin-top: 1.25rem;
          border: 1px solid #2a303d;
          border-radius: 8px;
          background: rgba(14, 16, 22, 0.92);
          overflow: hidden;
        }

        .search-heading,
        .list-heading,
        .preview-heading {
          justify-content: space-between;
          gap: 1rem;
        }

        .search-heading {
          padding: 1rem 1.15rem 0;
        }

        .search-heading h2,
        .list-heading h2,
        .preview-heading h2 {
          margin-top: 0.3rem;
        }

        .result-count,
        .list-heading > span {
          display: inline-flex;
          min-height: 26px;
          align-items: center;
          border: 1px solid #303746;
          border-radius: 999px;
          padding: 0 0.55rem;
          background: #141820;
          color: #aeb7c7;
          font-size: 0.7rem;
          font-weight: 750;
          white-space: nowrap;
        }

        .knowledge-search {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.6rem;
          padding: 0.9rem 1.15rem 1rem;
        }

        .search-field {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          min-height: 46px;
          border: 1px solid #343b49;
          border-radius: 7px;
          background: #090b10;
          color: #7f8a9d;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .search-field:focus-within {
          border-color: #7198d2;
          box-shadow: 0 0 0 3px rgba(95, 142, 211, 0.12);
        }

        .search-field > span {
          padding-left: 0.85rem;
          font-size: 1.15rem;
        }

        .search-field input {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          border: 0;
          outline: none;
          padding: 0 0.8rem 0 0.6rem;
          background: transparent;
          color: #f1f4f8;
          font-size: 0.86rem;
        }

        .search-field input::placeholder {
          color: #697486;
        }

        .knowledge-search button {
          min-width: 92px;
          border: 1px solid #9fd8c2;
          padding: 0 1rem;
          background: #b9ead7;
          color: #092017;
          font-size: 0.8rem;
        }

        .knowledge-search button:hover:not(:disabled) {
          background: #d2f5e7;
        }

        .result-list {
          border-top: 1px solid #252b36;
        }

        .result-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 0.8rem;
          padding: 1rem 1.15rem;
        }

        .result-row + .result-row {
          border-top: 1px solid #252b36;
        }

        .result-index,
        .chunk-number {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border: 1px solid #343d4c;
          border-radius: 6px;
          background: #151a23;
          color: #9eaabc;
          font-size: 0.66rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .result-meta,
        .result-footer,
        .chunk-meta {
          justify-content: space-between;
          gap: 0.8rem;
        }

        .result-meta strong {
          min-width: 0;
          color: #e9edf4;
          font-size: 0.79rem;
          overflow-wrap: anywhere;
        }

        .match {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 0.25rem 0.5rem;
          background: #292119;
          color: #e8c08e;
          font-size: 0.66rem;
          font-weight: 800;
        }

        .match.good {
          background: #13281e;
          color: #91e7b8;
        }

        .result-content > p {
          margin-top: 0.55rem;
          color: #bdc5d2;
          font-size: 0.82rem;
          line-height: 1.6;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .result-footer {
          margin-top: 0.65rem;
          color: #747f91;
          font-size: 0.68rem;
        }

        .result-footer button {
          border: 0;
          padding: 0;
          background: transparent;
          color: #9abdec;
          cursor: pointer;
          font-size: 0.7rem;
          font-weight: 750;
        }

        .result-footer button:hover {
          color: #c9dcf5;
        }

        .empty-search {
          display: grid;
          gap: 0.2rem;
          border-top: 1px solid #252b36;
          padding: 1rem 1.15rem;
          color: #d5dbe5;
          font-size: 0.78rem;
        }

        .empty-search span {
          color: #818b9d;
          font-size: 0.75rem;
        }

        .knowledge-workspace {
          display: grid;
          grid-template-columns: minmax(245px, 0.72fr) minmax(0, 1.65fr);
          margin-top: 1rem;
          border: 1px solid #2a303d;
          border-radius: 8px;
          background: rgba(14, 16, 22, 0.92);
          scroll-margin-top: 1rem;
          overflow: hidden;
        }

        .document-list {
          min-width: 0;
          border-right: 1px solid #2a303d;
          background: #0c0e13;
        }

        .list-heading,
        .preview-heading {
          min-height: 78px;
          padding: 1rem 1.05rem;
          border-bottom: 1px solid #282e39;
        }

        .document-items {
          padding: 0.45rem 0;
        }

        .document-items > button {
          position: relative;
          display: grid;
          width: 100%;
          grid-template-columns: 30px minmax(0, 1fr) auto;
          gap: 0.65rem;
          align-items: center;
          border: 0;
          padding: 0.78rem 0.8rem;
          background: transparent;
          color: #dce2eb;
          cursor: pointer;
          text-align: left;
        }

        .document-items > button::before {
          position: absolute;
          top: 0.55rem;
          bottom: 0.55rem;
          left: 0;
          width: 2px;
          border-radius: 0 2px 2px 0;
          background: transparent;
          content: "";
        }

        .document-items > button:hover {
          background: rgba(255, 255, 255, 0.035);
        }

        .document-items > button.active {
          background: #151c20;
        }

        .document-items > button.active::before {
          background: #80e1aa;
        }

        .document-icon {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border: 1px solid #313a47;
          border-radius: 6px;
          background: #171b23;
          color: #99a7b9;
          font-size: 0.9rem;
        }

        .active .document-icon {
          border-color: #315b48;
          background: #14241c;
          color: #8ce2b3;
        }

        .document-copy {
          display: grid;
          min-width: 0;
          gap: 0.22rem;
        }

        .document-copy strong {
          overflow: hidden;
          font-size: 0.75rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .document-copy small {
          overflow: hidden;
          color: #747f91;
          font-size: 0.65rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chevron {
          color: #596477;
          font-size: 1.15rem;
        }

        .active .chevron {
          color: #8fcca9;
        }

        .preview-panel {
          min-width: 0;
        }

        .preview-heading {
          align-items: flex-end;
        }

        .preview-heading h2 {
          overflow-wrap: anywhere;
        }

        .document-summary {
          display: grid;
          flex: 0 0 auto;
          gap: 0.05rem;
          text-align: right;
        }

        .document-summary strong {
          color: #f4f7fb;
          font-size: 1rem;
        }

        .document-summary span {
          color: #7f899b;
          font-size: 0.66rem;
        }

        .chunk-list {
          padding: 0 1.05rem;
        }

        .chunk-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 0.9rem;
          padding: 1.05rem 0;
        }

        .chunk-row + .chunk-row {
          border-top: 1px solid #282e39;
        }

        .chunk-meta strong {
          color: #aeb7c5;
          font-size: 0.7rem;
        }

        .chunk-meta span {
          color: #697486;
          font-size: 0.66rem;
        }

        .chunk-row p {
          margin-top: 0.55rem;
          color: #d5dae3;
          font-size: 0.84rem;
          line-height: 1.7;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .state,
        .preview-empty {
          display: flex;
          min-height: 150px;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          color: #778295;
          font-size: 0.76rem;
          line-height: 1.5;
          text-align: center;
        }

        .loader {
          width: 12px;
          height: 12px;
          border: 2px solid #354052;
          border-top-color: #8adfb1;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .knowledge-error {
          margin-top: 1rem;
          border: 1px solid #71333d;
          border-radius: 7px;
          padding: 0.75rem 0.85rem;
          background: #251117;
          color: #ffc4ca;
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .search-error {
          margin: 0 1.15rem 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1040px) {
          .knowledge-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .knowledge-stats {
            margin-right: auto;
          }
        }

        @media (max-width: 820px) {
          .knowledge-shell {
            width: min(100% - 1rem, 1180px);
            padding-top: 1rem;
          }

          .knowledge-workspace {
            grid-template-columns: 1fr;
          }

          .document-list {
            border-right: 0;
            border-bottom: 1px solid #2a303d;
          }

          .document-items {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .title-group {
            align-items: flex-start;
          }

          .knowledge-mark {
            width: 38px;
            height: 38px;
            font-size: 1.45rem;
          }

          .header-actions,
          .knowledge-stats {
            flex-wrap: wrap;
          }

          .knowledge-stats {
            width: 100%;
            justify-content: flex-start;
            border-right: 0;
            padding-right: 0;
          }

          .add-document {
            flex: 1;
          }

          .knowledge-search,
          .document-items {
            grid-template-columns: 1fr;
          }

          .knowledge-search button {
            min-height: 44px;
          }

          .search-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .result-meta,
          .result-footer,
          .preview-heading,
          .chunk-meta {
            align-items: flex-start;
            flex-direction: column;
          }

          .result-footer button {
            min-height: 28px;
          }

          .document-summary {
            text-align: left;
          }

          .chunk-row,
          .result-row {
            grid-template-columns: 28px minmax(0, 1fr);
            gap: 0.65rem;
          }

          .result-index,
          .chunk-number {
            width: 26px;
            height: 26px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .loader {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
