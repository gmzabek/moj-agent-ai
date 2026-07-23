"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type ConversationRow = {
  id: string;
  title: string | null;
  updated_at: string;
};

type MessageRow = {
  conversation_id: string;
  content: string;
  created_at: string;
};

type ConversationSummary = ConversationRow & {
  messageCount: number;
  lastMessage: string | null;
  messageContents: string[];
};

function messagePreview(content: string | null) {
  if (!content) {
    return "Brak wiadomości w tej rozmowie.";
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 100 ? `${normalized.slice(0, 97)}...` : normalized;
}

function plural(value: number, forms: [string, string, string]) {
  const lastDigit = value % 10;
  const lastTwoDigits = value % 100;

  if (value === 1) {
    return forms[0];
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return forms[1];
  }

  return forms[2];
}

function formatLastActivity(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nieznana data";
  }

  const now = new Date();
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));

  if (elapsedMinutes < 1) {
    return "przed chwilą";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${plural(elapsedMinutes, ["minutę", "minuty", "minut"])} temu`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} ${plural(elapsedHours, ["godzinę", "godziny", "godzin"])} temu`;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activityDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const elapsedDays = Math.round((today.getTime() - activityDay.getTime()) / 86_400_000);

  if (elapsedDays === 1) {
    return "wczoraj";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function highlightMatch(text: string, query: string): ReactNode {
  if (!query) {
    return text;
  }

  const normalizedText = text.toLocaleLowerCase("pl-PL");
  const normalizedQuery = query.toLocaleLowerCase("pl-PL");
  const parts: ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);

  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(text.slice(startIndex, matchIndex));
    }

    const endIndex = matchIndex + query.length;
    parts.push(
      <mark className="history-highlight" key={`${matchIndex}-${endIndex}`}>
        {text.slice(matchIndex, endIndex)}
      </mark>,
    );
    startIndex = endIndex;
    matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);
  }

  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }

  return parts.length > 0 ? parts : text;
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadHistory() {
      setIsLoading(true);
      setError(null);

      try {
        // Tabela conversations nie ma jeszcze user_id, więc pobieramy całą historię dev.
        const { data: conversationRows, error: conversationsError } = await supabase
          .from("conversations")
          .select("id, title, updated_at")
          .order("updated_at", { ascending: false });

        if (conversationsError) {
          throw conversationsError;
        }

        const rows = (conversationRows ?? []) as ConversationRow[];

        if (rows.length === 0) {
          if (!isCancelled) {
            setConversations([]);
          }
          return;
        }

        const { data: messageRows, error: messagesError } = await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in(
            "conversation_id",
            rows.map((conversation) => conversation.id),
          )
          .order("created_at", { ascending: false });

        if (messagesError) {
          throw messagesError;
        }

        const messagesByConversation = new Map<
          string,
          { count: number; lastMessage: string | null; messageContents: string[] }
        >();

        for (const message of (messageRows ?? []) as MessageRow[]) {
          const summary = messagesByConversation.get(message.conversation_id) ?? {
            count: 0,
            lastMessage: null,
            messageContents: [],
          };

          summary.count += 1;
          summary.lastMessage ??= message.content;
          summary.messageContents.push(message.content);
          messagesByConversation.set(message.conversation_id, summary);
        }

        if (!isCancelled) {
          setConversations(
            rows.map((conversation) => {
              const messages = messagesByConversation.get(conversation.id);

              return {
                ...conversation,
                messageCount: messages?.count ?? 0,
                lastMessage: messages?.lastMessage ?? null,
                messageContents: messages?.messageContents ?? [],
              };
            }),
          );
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nie udało się pobrać historii rozmów z Supabase.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function deleteConversation(conversation: ConversationSummary) {
    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingConversationId(conversation.id);
    setError(null);
    setToast(null);

    try {
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversation.id);

      if (messagesError) {
        throw messagesError;
      }

      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversation.id);

      if (conversationError) {
        throw conversationError;
      }

      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      setToast("Rozmowa usunięta");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nie udało się usunąć rozmowy.",
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

  const totalMessages = useMemo(
    () => conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0),
    [conversations],
  );
  const normalizedSearchQuery = searchQuery.trim();
  const visibleConversations = useMemo(() => {
    if (!normalizedSearchQuery) {
      return conversations.map((conversation) => ({
        conversation,
        matchedMessage: null,
      }));
    }

    const normalizedQuery = normalizedSearchQuery.toLocaleLowerCase("pl-PL");

    return conversations.flatMap((conversation) => {
      const titleMatches = (conversation.title ?? "")
        .toLocaleLowerCase("pl-PL")
        .includes(normalizedQuery);
      const matchedMessage = conversation.messageContents.find((content) =>
        content.toLocaleLowerCase("pl-PL").includes(normalizedQuery),
      );

      return titleMatches || matchedMessage
        ? [{ conversation, matchedMessage: matchedMessage ?? null }]
        : [];
    });
  }, [conversations, normalizedSearchQuery]);

  return (
    <main className="history-shell">
      <header className="history-header">
        <div>
          <p className="eyebrow">Pamięć agenta</p>
          <h1>{"\u{1F4DC}"} Historia rozmów</h1>
          <p>Wszystkie Twoje rozmowy z agentem</p>
        </div>
        {!isLoading && conversations.length > 0 ? (
          <span className="history-summary">
            {conversations.length} rozm. · {totalMessages} wiad.
          </span>
        ) : null}
      </header>

      <label className="history-search">
        <span>Szukaj w historii</span>
        <input
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Szukaj w rozmowach..."
          type="search"
          value={searchQuery}
        />
      </label>

      {error ? <p className="history-error">Supabase: {error}</p> : null}
      {toast ? <p className="history-toast" role="status">{toast}</p> : null}

      {isLoading ? (
        <section className="history-state" aria-live="polite" role="status">
          <span className="history-spinner" aria-hidden="true" />
          <p>Wczytuję historię rozmów...</p>
        </section>
      ) : conversations.length === 0 ? (
        <section className="history-state">
          <p>Nie masz jeszcze żadnych rozmów. Zacznij nową!</p>
          <Link className="history-primary-action" href="/agent">
            Rozpocznij rozmowę
          </Link>
        </section>
      ) : visibleConversations.length === 0 ? (
        <section className="history-state">
          <p>Nie znaleziono rozmów pasujących do wyszukiwania.</p>
        </section>
      ) : (
        <section className="history-list" aria-label="Lista rozmów">
          {visibleConversations.map(({ conversation, matchedMessage }) => {
            const isDeleting = deletingConversationId === conversation.id;
            const title = conversation.title?.trim() || "Bez tytułu";
            const preview = matchedMessage ?? conversation.lastMessage;

            return (
              <article className="history-card" key={conversation.id}>
                <Link
                  className="history-card-main"
                  href={`/history/${conversation.id}`}
                >
                  <div className="history-card-heading">
                    <h2>{highlightMatch(title, normalizedSearchQuery)}</h2>
                    <time dateTime={conversation.updated_at}>
                      {formatLastActivity(conversation.updated_at)}
                    </time>
                  </div>
                  <p className="history-preview">
                    {highlightMatch(messagePreview(preview), normalizedSearchQuery)}
                  </p>
                  <p className="history-message-count">
                    {conversation.messageCount} {plural(conversation.messageCount, ["wiadomość", "wiadomości", "wiadomości"])}
                  </p>
                </Link>
                <button
                  aria-label={`Usuń rozmowę: ${conversation.title || "Bez tytułu"}`}
                  className="history-delete-button"
                  disabled={isDeleting}
                  onClick={() => void deleteConversation(conversation)}
                  type="button"
                >
                  {isDeleting ? "Usuwanie..." : "\u{1F5D1} Usuń"}
                </button>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .history-shell {
          width: min(920px, calc(100% - 1.5rem));
          margin: 0 auto;
          padding: 2rem 0 3rem;
        }

        .history-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .history-header h1 {
          margin: 0;
          font-size: clamp(1.65rem, 4vw, 2.4rem);
          line-height: 1.15;
        }

        .history-header p:not(.eyebrow) {
          margin: 0.5rem 0 0;
          color: var(--muted);
        }

        .history-summary,
        .history-message-count,
        time {
          color: var(--muted);
          font-size: 0.82rem;
        }

        .history-summary {
          white-space: nowrap;
        }

        .history-search {
          display: grid;
          gap: 0.4rem;
          margin: 0 0 1rem;
          color: #b9b1c7;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .history-search input {
          width: 100%;
          min-height: 42px;
          border: 1px solid #332a46;
          border-radius: 8px;
          padding: 0 0.8rem;
          background: #0f0c15;
          color: var(--text);
          outline: none;
        }

        .history-search input:focus {
          border-color: #6d77ff;
          box-shadow: 0 0 0 3px rgba(109, 119, 255, 0.14);
        }

        .history-list {
          display: grid;
          gap: 0.7rem;
        }

        .history-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 1rem;
          background: #1a1a2a;
          transition: border-color 160ms ease, background 160ms ease;
        }

        .history-card:hover,
        .history-card:focus-within {
          border-color: #61f8f8;
          background: #222238;
        }

        .history-card-main {
          display: block;
          flex: 1 1 auto;
          min-width: 0;
        }

        .history-card-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
        }

        .history-card h2 {
          margin: 0;
          color: #ffffff;
          overflow: hidden;
          font-size: 1rem;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 800;
        }

        .history-card time {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .history-preview {
          display: -webkit-box;
          margin: 0.45rem 0 0;
          color: #c6c0d1;
          font-style: italic;
          line-height: 1.5;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        :global(.history-highlight) {
          border-radius: 3px;
          padding: 0 0.1em;
          background: #d9b84a;
          color: #17120a;
        }

        .history-message-count {
          margin: 0.65rem 0 0;
        }

        .history-delete-button {
          flex: 0 0 auto;
          min-height: 34px;
          border: 1px solid #5a3038;
          border-radius: 7px;
          padding: 0.4rem 0.65rem;
          background: #1f1118;
          color: #ffc7cc;
          font-size: 0.78rem;
          font-weight: 800;
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transition: border-color 160ms ease, background 160ms ease, opacity 160ms ease;
        }

        .history-card:hover .history-delete-button,
        .history-card:focus-within .history-delete-button {
          opacity: 1;
          pointer-events: auto;
        }

        .history-delete-button:hover:not(:disabled) {
          border-color: var(--danger);
          background: #2b121b;
        }

        .history-delete-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .history-state {
          display: grid;
          min-height: 300px;
          place-items: center;
          align-content: center;
          gap: 0.85rem;
          border: 1px dashed #352d46;
          border-radius: 8px;
          color: var(--muted);
          text-align: center;
        }

        .history-state p {
          margin: 0;
        }

        .history-primary-action {
          min-height: 40px;
          border: 1px solid #57b48e;
          border-radius: 7px;
          padding: 0.6rem 0.85rem;
          background: #173526;
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 800;
        }

        .history-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #342c46;
          border-top-color: #72e6ac;
          border-radius: 50%;
          animation: history-spin 700ms linear infinite;
        }

        .history-error {
          margin: 0 0 1rem;
          border: 1px solid #7f3540;
          border-radius: 8px;
          padding: 0.75rem 0.85rem;
          background: #251119;
          color: #ffc7cc;
          line-height: 1.45;
        }

        .history-toast {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          z-index: 30;
          margin: 0;
          border: 1px solid #57b48e;
          border-radius: 8px;
          padding: 0.75rem 0.9rem;
          background: #173526;
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 800;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        }

        @keyframes history-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 600px) {
          .history-header,
          .history-card,
          .history-card-heading {
            align-items: stretch;
            flex-direction: column;
          }

          .history-summary {
            white-space: normal;
          }

          .history-card h2 {
            white-space: normal;
          }

          .history-delete-button {
            align-self: flex-start;
            opacity: 1;
            pointer-events: auto;
          }
        }
      `}</style>
    </main>
  );
}
