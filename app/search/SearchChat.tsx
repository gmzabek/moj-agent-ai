"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AttachmentPreview,
  ImageFileInput,
  useImageAttachment,
} from "../components/imageAttachment";
import { MarkdownView } from "../components/MarkdownView";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: { title: string; url: string }[];
};

type StreamChunk =
  | { type: "text-delta"; delta: string }
  | { type: "source-url"; title?: string; url: string }
  | { type: "error"; errorText?: string }
  | { type: string; [key: string]: unknown };

const examples = [
  "Jakie są najnowsze wiadomości o sztucznej inteligencji?",
  "Ile kosztuje iPhone 16 Pro w Polsce?",
  "Kto wygrał ostatni mecz reprezentacji Polski?",
  "Jakie filmy są teraz w kinach?",
];

const storageKey = "leo-search-history";
let messageIdCounter = 0;

function createMessageId(prefix: string) {
  messageIdCounter += 1;
  return `${prefix}-${messageIdCounter}`;
}

function toApiMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.text }],
  }));
}

function appendAssistantDelta(
  messages: ChatMessage[],
  assistantId: string,
  delta: string,
) {
  return messages.map((message) =>
    message.id === assistantId
      ? { ...message, text: `${message.text}${delta}` }
      : message,
  );
}

function appendAssistantSource(
  messages: ChatMessage[],
  assistantId: string,
  source: { title: string; url: string },
) {
  return messages.map((message) => {
    if (message.id !== assistantId) {
      return message;
    }

    const sources = message.sources ?? [];

    if (sources.some((item) => item.url === source.url)) {
      return message;
    }

    return { ...message, sources: [...sources, source] };
  });
}

export function SearchChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasUserInteractedRef = useRef(false);
  const imageAttachment = useImageAttachment();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const savedMessages = window.localStorage.getItem(storageKey);

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);

        if (Array.isArray(parsedMessages) && !hasUserInteractedRef.current) {
          queueMicrotask(() => setMessages(parsedMessages));
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    queueMicrotask(() => setHasLoadedHistory(true));
  }, []);

  useEffect(() => {
    if (hasLoadedHistory) {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [hasLoadedHistory, messages]);

  async function sendPrompt(text: string) {
    const prompt = text.trim();

    if ((!prompt && !imageAttachment.attachedImage) || isLoading) {
      return;
    }

    hasUserInteractedRef.current = true;
    const attachedImage = imageAttachment.attachedImage;
    const messageText = prompt || "Co widzisz na tym obrazie?";

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      text: messageText,
    };
    const assistantMessage: ChatMessage = {
      id: createMessageId("assistant"),
      role: "assistant",
      text: "",
      sources: [],
    };
    const nextMessages = [...messages, userMessage, assistantMessage];

    setError("");
    setIsLoading(true);
    setMessages(nextMessages);
    setInput("");
    imageAttachment.clearImage();
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: toApiMessages(nextMessages.filter((message) => message.text)),
          image: attachedImage?.dataUrl,
          model: "flash",
        }),
      });

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
            setMessages((currentMessages) =>
              appendAssistantDelta(
                currentMessages,
                assistantMessage.id,
                String(chunk.delta ?? ""),
              ),
            );
          }

          if (chunk.type === "source-url") {
            const url = String(chunk.url ?? "");

            if (!url) {
              continue;
            }

            setMessages((currentMessages) =>
              appendAssistantSource(currentMessages, assistantMessage.id, {
                title: String(chunk.title || url),
                url,
              }),
            );
          }

          if (chunk.type === "error") {
            setError(String(chunk.errorText || "Nieznany błąd po stronie API."));
          }
        }
      }
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Nieznany błąd.";
      setError(message);
      setMessages((currentMessages) =>
        appendAssistantDelta(
          currentMessages,
          assistantMessage.id,
          `Nie udało się pobrać odpowiedzi: ${message}`,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendPrompt(input || inputRef.current?.value || "");
  }

  function handleNewConversation() {
    setMessages([]);
    setInput("");
    setError("");
    imageAttachment.clearImage();
    window.localStorage.removeItem(storageKey);
  }

  return (
    <main
      className="chat-shell"
      onDragLeave={imageAttachment.handleDragLeave}
      onDragOver={imageAttachment.handleDragOver}
      onDrop={imageAttachment.handleDrop}
    >
      {imageAttachment.isDraggingImage && (
        <div className="drop-overlay">Upuść obraz tutaj</div>
      )}

      <header className="chat-header">
        <h1>🌐 Agent z wyszukiwarką</h1>
        <p className="agent-description">
          Przeszukuję prawdziwy internet i czytam strony
        </p>

        <div className="examples" aria-label="Przykłady">
          {examples.map((example) => (
            <button
              className="example-button"
              disabled={isLoading}
              key={example}
              onClick={() => sendPrompt(example)}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>
      </header>

      <section className="messages" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>
              Zapytaj o aktualne informacje albo podaj adres URL strony do
              przeczytania.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={`message ${
                message.role === "user" ? "message-user" : "message-ai"
              }`}
              key={message.id}
            >
              {message.role === "user" ? (
                <p>{message.text}</p>
              ) : (
                <MarkdownView text={message.text || " "} />
              )}
              {message.role === "assistant" &&
                message.sources &&
                message.sources.length > 0 && (
                  <div className="source-links" aria-label="Źródła">
                    {message.sources.map((source) => (
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
          ))
        )}

        {isLoading && (
          <div className="thinking" role="status">
            Agent szuka...
          </div>
        )}

        {error && <p className="error">Coś poszło nie tak: {error}</p>}
        <div ref={bottomRef} />
      </section>

      {imageAttachment.attachedImage && (
        <AttachmentPreview
          image={imageAttachment.attachedImage}
          onRemove={imageAttachment.clearImage}
        />
      )}
      {imageAttachment.imageError && (
        <p className="error">{imageAttachment.imageError}</p>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <ImageFileInput
          fileInputRef={imageAttachment.fileInputRef}
          onChange={imageAttachment.handleFileInput}
        />
        <button
          aria-label="Dodaj obraz"
          className="attach-button"
          disabled={isLoading}
          onClick={imageAttachment.openFilePicker}
          type="button"
        >
          IMG
        </button>
        <input
          aria-label="Wiadomość"
          disabled={isLoading}
          onChange={(event) => setInput(event.target.value)}
          onPaste={imageAttachment.handlePaste}
          placeholder="Zapytaj o cokolwiek aktualnego..."
          ref={inputRef}
          value={input}
        />
        <button
          className="send-button"
          disabled={
            isLoading ||
            (input.trim().length === 0 && !imageAttachment.attachedImage)
          }
          type="submit"
        >
          Wyślij
        </button>
      </form>

      <button className="clear-button" onClick={handleNewConversation} type="button">
        Nowa rozmowa
      </button>

      <style jsx>{`
        .chat-shell {
          display: grid;
          grid-template-rows: auto auto 1fr auto auto;
          gap: 18px;
          min-height: 100vh;
          max-width: 920px;
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

        .chat-header {
          border-bottom: 1px solid #242430;
          padding-bottom: 18px;
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
          grid-template-columns: auto 1fr auto;
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

        .attach-button {
          width: 48px;
          min-height: 48px;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11111a;
          color: #ededed;
          font-size: 0.8rem;
          font-weight: 900;
        }

        .attach-button:hover {
          border-color: #7f95ff;
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
        .attach-button:disabled,
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

          .send-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
