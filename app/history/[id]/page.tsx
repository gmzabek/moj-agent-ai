"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";

type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nieznana data";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ConversationHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadConversation() {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: conversationRow, error: conversationError } = await supabase
          .from("conversations")
          .select("id, title, updated_at")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (conversationError) {
          throw conversationError;
        }

        if (!conversationRow) {
          if (!isCancelled) {
            setConversation(null);
            setMessages([]);
          }
          return;
        }

        const { data: messageRows, error: messagesError } = await supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        if (messagesError) {
          throw messagesError;
        }

        if (!isCancelled) {
          setConversation(conversationRow as Conversation);
          setMessages((messageRows ?? []) as Message[]);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nie udało się pobrać rozmowy z Supabase.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (id) {
      void loadConversation();
    }

    return () => {
      isCancelled = true;
    };
  }, [id, user]);

  const conversationTitle = conversation?.title?.trim() || "Bez tytułu";

  return (
    <main className="history-detail-shell">
      <header className="history-detail-header">
        <div>
          <Link className="history-back-link" href="/history">
            {"\u2190"} Wróć do listy
          </Link>
          <h1>{conversationTitle}</h1>
          {conversation ? <p>{formatDate(conversation.updated_at)}</p> : null}
        </div>
        {conversation ? (
          <Link
            className="history-continue-link"
            href={`/agent?conversation=${encodeURIComponent(conversation.id)}`}
          >
            {"\u{1F504}"} Kontynuuj rozmowę
          </Link>
        ) : null}
      </header>

      {error ? <p className="history-detail-error">Supabase: {error}</p> : null}

      {isLoading ? (
        <section className="history-detail-state" aria-live="polite" role="status">
          <span className="history-detail-spinner" aria-hidden="true" />
          <p>Wczytuję rozmowę...</p>
        </section>
      ) : !conversation ? (
        <section className="history-detail-state">
          <p>Ta rozmowa nie istnieje lub została usunięta.</p>
          <Link className="history-back-link" href="/history">
            Wróć do historii
          </Link>
        </section>
      ) : messages.length === 0 ? (
        <section className="history-detail-state">
          <p>W tej rozmowie nie ma jeszcze wiadomości.</p>
        </section>
      ) : (
        <section className="history-message-list" aria-label="Wiadomości w rozmowie">
          {messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <article
                className={`history-message ${isUser ? "history-message-user" : "history-message-agent"}`}
                key={message.id}
              >
                <p className="history-message-meta">
                  {isUser ? "Ty" : "Agent"} · {formatMessageTime(message.created_at)}
                </p>
                <p className="history-message-content">{message.content}</p>
              </article>
            );
          })}
        </section>
      )}

      <style jsx>{`
        .history-detail-shell {
          width: min(920px, calc(100% - 1.5rem));
          margin: 0 auto;
          padding: 2rem 0 3rem;
        }

        .history-detail-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .history-back-link {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          color: #b9b1c7;
          font-size: 0.84rem;
          font-weight: 800;
        }

        .history-back-link:hover {
          color: #ffffff;
        }

        h1 {
          margin: 0.7rem 0 0;
          font-size: clamp(1.5rem, 4vw, 2.3rem);
          line-height: 1.2;
        }

        .history-detail-header p {
          margin: 0.45rem 0 0;
          color: var(--muted);
        }

        .history-continue-link {
          flex: 0 0 auto;
          min-height: 40px;
          border: 1px solid #57b48e;
          border-radius: 7px;
          padding: 0.6rem 0.85rem;
          background: #173526;
          color: #ffffff;
          font-size: 0.84rem;
          font-weight: 800;
        }

        .history-message-list {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .history-message {
          width: min(100%, 760px);
          border-radius: 8px;
          padding: 0.85rem 1rem;
        }

        .history-message-user {
          align-self: flex-end;
          background: #24283a;
        }

        .history-message-agent {
          align-self: flex-start;
          border: 1px solid #303747;
          background: #121621;
        }

        .history-message-meta {
          margin: 0;
          color: #b9c6d9;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .history-message-content {
          margin: 0.45rem 0 0;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .history-detail-state {
          display: grid;
          min-height: 280px;
          place-items: center;
          align-content: center;
          gap: 0.85rem;
          border: 1px dashed #352d46;
          border-radius: 8px;
          color: var(--muted);
          text-align: center;
        }

        .history-detail-state p {
          margin: 0;
        }

        .history-detail-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #342c46;
          border-top-color: #72e6ac;
          border-radius: 50%;
          animation: history-detail-spin 700ms linear infinite;
        }

        .history-detail-error {
          margin: 0 0 1rem;
          border: 1px solid #7f3540;
          border-radius: 8px;
          padding: 0.75rem 0.85rem;
          background: #251119;
          color: #ffc7cc;
          line-height: 1.45;
        }

        @keyframes history-detail-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 600px) {
          .history-detail-header {
            align-items: stretch;
            flex-direction: column;
          }

          .history-continue-link {
            align-self: flex-start;
          }

          .history-message {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
