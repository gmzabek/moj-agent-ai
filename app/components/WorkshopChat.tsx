"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useMemo, useRef, useState, useEffect } from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import { reportGeminiFallback } from "./geminiFallbackStatus";
import { MarkdownView } from "./MarkdownView";
import { useSupabaseConversation } from "./useSupabaseConversation";
import { useUserProfile } from "./useUserProfile";

type ExampleMode = "send" | "insert";

type WorkshopChatProps = {
  title: string;
  subtitle: string;
  endpoint: string;
  placeholder: string;
  storageKey: string;
  examples?: string[];
  exampleMode?: ExampleMode;
  renderMarkdown?: boolean;
  emptyText?: string;
  enableUserProfile?: boolean;
};

function getMessageText(parts: { type: string; text?: string }[]) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function getSourceUrls(parts: UIMessage["parts"]) {
  return parts
    .filter((part) => part.type === "source-url")
    .map((part) => ({
      title: "title" in part && part.title ? part.title : part.url,
      url: part.url,
    }));
}

function parseKnowledgeSources(text: string) {
  const sources: string[] = [];
  const contentLines = text.split("\n").filter((line) => {
    const match = line.match(
      /^\s*(?:📎\s*)?(?:Źródło|Źródła|Zrodlo|Zrodla):\s*(.+?)\s*$/i,
    );

    if (!match) {
      return true;
    }

    for (const source of match[1].split(",")) {
      const cleanSource = source.trim();

      if (cleanSource && !sources.includes(cleanSource)) {
        sources.push(cleanSource);
      }
    }

    return false;
  });

  return {
    sources,
    text: contentLines.join("\n").trim(),
  };
}

function getEndpointModelInfo(endpoint: string) {
  if (endpoint === "/api/chat") {
    return {
      fallbackModel: "brak automatycznego fallbacku",
      requestedModel: "gemini-3.1-flash-lite",
    };
  }

  if (endpoint === "/api/fewshot") {
    return {
      fallbackModel: "lokalna odpowiedź awaryjna",
      requestedModel: "gemini-3.1-flash-lite",
    };
  }

  return {
    fallbackModel: "brak automatycznego fallbacku",
    requestedModel: "gemini-3.1-flash-lite",
  };
}

export function WorkshopChat({
  title,
  subtitle,
  endpoint,
  placeholder,
  examples = [],
  exampleMode = "insert",
  renderMarkdown = false,
  enableUserProfile = false,
  emptyText = "Zadaj pytanie, aby rozpocząć rozmowę.",
}: WorkshopChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const reportedFallbackRef = useRef("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: endpoint,
        fetch: authenticatedFetch,
      }),
    [endpoint],
  );
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });
  const { isProfileLoading, profile, profileError, userId } = useUserProfile();
  const isLoading = status === "submitted" || status === "streaming";
  const welcomeShownRef = useRef(false);
  const {
    isMemoryBusy,
    isRestoringConversation,
    memoryError,
    startNewConversation,
  } = useSupabaseConversation({
    messages,
    setMessages,
    status,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (
      !enableUserProfile ||
      isProfileLoading ||
      isRestoringConversation ||
      profileError ||
      welcomeShownRef.current
    ) {
      return;
    }

    const welcomeText = profile?.displayName
      ? `Cze\u015b\u0107, ${profile.displayName}! Mi\u0142o Ci\u0119 znowu widzie\u0107. W czym mog\u0119 Ci pom\u00f3c?`
      : "Cze\u015b\u0107! Nie znamy si\u0119 jeszcze. Jak masz na imi\u0119?";
    const alreadyWelcomed = profile?.displayName
      ? messages.some(
          (message) =>
            message.role === "assistant" &&
            getMessageText(message.parts).includes(
              `Cze\u015b\u0107, ${profile.displayName}!`,
            ),
        )
      : messages.length > 0;

    if (alreadyWelcomed) {
      welcomeShownRef.current = true;
      return;
    }

    welcomeShownRef.current = true;
    setMessages([
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: welcomeText,
          },
        ],
      },
    ]);
  }, [
    enableUserProfile,
    isProfileLoading,
    isRestoringConversation,
    messages,
    profile?.displayName,
    profileError,
    setMessages,
  ]);

  useEffect(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    const latestAssistantText = latestAssistant
      ? getMessageText(latestAssistant.parts)
      : "";
    const fallbackSignal = error?.message || latestAssistantText;

    if (fallbackSignal && fallbackSignal !== reportedFallbackRef.current) {
      const reportedStatus = reportGeminiFallback(fallbackSignal, {
        ...getEndpointModelInfo(endpoint),
        source: title,
      });

      if (reportedStatus) {
        reportedFallbackRef.current = fallbackSignal;
      }
    }
  }, [endpoint, error, messages, title]);

  function sendPrompt(text: string) {
    const prompt = text.trim();

    if (
      !prompt ||
      isLoading ||
      isRestoringConversation ||
      (enableUserProfile && isProfileLoading)
    ) {
      return;
    }

    sendMessage(
      { text: prompt },
      enableUserProfile ? { body: { userId } } : undefined,
    );
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendPrompt(input);
  }

  function handleExample(example: string) {
    if (exampleMode === "send") {
      sendPrompt(example);
      return;
    }

    setInput(example);
  }

  async function handleNewConversation() {
    setInput("");
    await startNewConversation();
  }

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <div className="chat-title-row">
          <div>
            <h1>{title}</h1>
            <p className="agent-description">{subtitle}</p>
          </div>
          <button
            className="clear-button"
            disabled={isLoading || isMemoryBusy}
            onClick={handleNewConversation}
            type="button"
          >
            + Nowa rozmowa
          </button>
        </div>

        {examples.length > 0 && (
          <div className="examples" aria-label="Przykłady">
            {examples.map((example) => (
              <button
                className="example-button"
                disabled={isLoading || isRestoringConversation}
                key={example}
                onClick={() => handleExample(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </header>

      <section className="messages" aria-live="polite">
        {isRestoringConversation ? (
          <div className="thinking" role="status">
            Wczytuję rozmowę...
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p>{emptyText}</p>
          </div>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message.parts);
            const isUser = message.role === "user";
            const sources = getSourceUrls(message.parts);
            const knowledgeSources = isUser
              ? { sources: [], text }
              : parseKnowledgeSources(text);
            const visibleText = knowledgeSources.text || text;

            return (
              <article
                className={`message ${isUser ? "message-user" : "message-ai"}`}
                key={message.id}
              >
                {renderMarkdown && !isUser ? (
                  <MarkdownView text={visibleText} />
                ) : (
                  <p>{visibleText}</p>
                )}
                {!isUser && knowledgeSources.sources.length > 0 && (
                  <div className="knowledge-sources" aria-label="Źródła RAG">
                    <span aria-hidden="true">📎</span>
                    <strong>
                      {knowledgeSources.sources.length === 1 ? "Źródło" : "Źródła"}:
                    </strong>
                    {knowledgeSources.sources.map((source) => (
                      <a
                        href={`/knowledge?document=${encodeURIComponent(source)}`}
                        key={source}
                      >
                        {source}
                      </a>
                    ))}
                  </div>
                )}
                {!isUser && sources.length > 0 && (
                  <div className="source-links" aria-label="Źródła">
                    {sources.map((source) => (
                      <a
                        href={source.url}
                        key={source.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {source.title}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}

        {isLoading && (
          <div className="thinking" role="status">
            Agent pracuje...
          </div>
        )}

        {error && <p className="error">Coś poszło nie tak: {error.message}</p>}
        {memoryError && <p className="error">Pamięć Supabase: {memoryError}</p>}
        <div ref={bottomRef} />
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          aria-label="Wiadomość"
          disabled={isLoading || isRestoringConversation}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          value={input}
        />
        <button
          className="send-button"
          disabled={isLoading || isRestoringConversation || input.trim().length === 0}
          type="submit"
        >
          Wyślij
        </button>
      </form>

      <style jsx>{`
        .chat-shell {
          display: grid;
          grid-template-rows: auto auto 1fr auto auto;
          gap: 18px;
          min-height: 100vh;
          max-width: 920px;
          margin: 0 auto;
          padding: 32px 18px;
        }

        .chat-header {
          border-bottom: 1px solid #242430;
          padding-bottom: 18px;
        }

        .chat-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        h1 {
          margin: 0;
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.05;
        }

        .agent-description {
          max-width: 720px;
          margin: 12px 0 0;
          color: #b8bfd8;
          font-size: 1rem;
          line-height: 1.55;
        }

        .examples {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 18px;
        }

        .example-button,
        .send-button,
        .clear-button {
          transition:
            border-color 160ms ease,
            background 160ms ease,
            color 160ms ease;
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
        .clear-button:hover {
          border-color: #7f95ff;
        }

        .messages {
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          padding: 6px 2px 20px;
        }

        .empty-state {
          display: grid;
          min-height: 34vh;
          place-items: center;
          color: #b7bdd6;
          text-align: center;
        }

        .empty-state p {
          max-width: 30rem;
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.6;
        }

        .message {
          max-width: min(92%, 760px);
          border-radius: 8px;
          padding: 13px 15px;
          line-height: 1.55;
        }

        .message p {
          margin: 0;
          white-space: pre-wrap;
        }

        .source-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .source-links a {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          max-width: 100%;
          border: 1px solid #3a4056;
          border-radius: 8px;
          color: #dce3f6;
          padding: 0 10px;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .source-links a:hover {
          border-color: #9fb2ff;
          color: #ffffff;
        }

        .knowledge-sources {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          align-items: center;
          margin-top: 12px;
          border-top: 1px solid #303649;
          padding-top: 10px;
          color: #aeb7cc;
          font-size: 0.82rem;
        }

        .knowledge-sources strong {
          color: #d7deef;
        }

        .knowledge-sources a {
          border: 1px solid #3a4056;
          border-radius: 999px;
          color: #c9d4eb;
          padding: 0.18rem 0.55rem;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .knowledge-sources a:hover {
          border-color: #9fb2ff;
          color: #ffffff;
        }

        .message-user {
          align-self: flex-end;
          background: #2a2a3a;
        }

        .message-ai {
          align-self: flex-start;
          border: 1px solid #333;
          background: #1a1a2a;
        }

        .thinking,
        .error {
          align-self: flex-start;
          color: #a6adc8;
          font-size: 0.95rem;
        }

        .error {
          color: #ffb4b4;
        }

        .composer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          border-top: 1px solid #242430;
          padding-top: 18px;
        }

        input {
          width: 100%;
          min-height: 48px;
          border: 1px solid #333;
          border-radius: 8px;
          background: #11111a;
          color: #ededed;
          padding: 0 14px;
          outline: none;
        }

        input:focus {
          border-color: #7c8cff;
        }

        .send-button {
          min-width: 100px;
          min-height: 48px;
          border: 0;
          border-radius: 8px;
          background: #ededed;
          color: #0a0a0a;
          font-weight: 800;
        }

        .clear-button {
          justify-self: start;
          min-height: 40px;
          border: 1px solid #333;
          border-radius: 8px;
          background: #0f0f18;
          color: #ededed;
          padding: 0 12px;
          font-weight: 700;
        }

        .send-button:disabled,
        .example-button:disabled,
        .clear-button:disabled,
        input:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        @media (max-width: 640px) {
          .chat-shell {
            padding: 22px 14px;
          }

          .examples,
          .composer {
            grid-template-columns: 1fr;
          }

          .chat-title-row {
            align-items: stretch;
            flex-direction: column;
          }

          .send-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
