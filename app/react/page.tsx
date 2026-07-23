"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { reportGeminiFallback } from "../components/geminiFallbackStatus";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import {
  type ReactChatMessage,
  useReactSupabaseConversation,
} from "../components/useReactSupabaseConversation";
import { useUserProfile } from "../components/useUserProfile";

type ReactSection = {
  type: "thought" | "tool" | "observation" | "result" | "plain";
  heading: string;
  content: string;
};

type ModelMode = "flash" | "pro";

const scenarios = [
  "Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca w Wikipedii i powiedz, czy są jakieś święta w ten weekend.",
  "Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach i zapisz wszystkie kursy w notatkach.",
  "Porównaj pogodę w Warszawie, Berlinie i Paryżu. Które z tych miast ma dziś najlepszą pogodę?",
  "Ile dni do następnego święta w Polsce? Jaka będzie wtedy pogoda?",
];

const tools = [
  { icon: "🧮", name: "Kalkulator" },
  { icon: "🕐", name: "Data i czas" },
  { icon: "🌦️", name: "Pogoda" },
  { icon: "💱", name: "Kursy NBP" },
  { icon: "📅", name: "Święta" },
  { icon: "📚", name: "Wikipedia" },
  { icon: "📝", name: "Zapis notatek" },
  { icon: "📋", name: "Odczyt notatek" },
  { icon: "📄", name: "Czytanie stron" },
];

function subscribeToHydrationStore() {
  return () => {};
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

function getSectionType(heading: string): ReactSection["type"] {
  const normalized = heading.toLowerCase();

  if (normalized.includes("myśl") || normalized.includes("mysl")) {
    return "thought";
  }

  if (normalized.includes("narzędzie") || normalized.includes("narzedzie")) {
    return "tool";
  }

  if (normalized.includes("obserw")) {
    return "observation";
  }

  if (normalized.includes("wynik")) {
    return "result";
  }

  return "plain";
}

function parseReactSections(markdown: string): ReactSection[] {
  const lines = markdown.split("\n");
  const sections: ReactSection[] = [];
  let current: ReactSection | null = null;
  const headingRegex = /^###\s+(.+)$/;

  for (const line of lines) {
    const headingMatch = line.match(headingRegex);

    if (headingMatch) {
      if (current) {
        sections.push({ ...current, content: current.content.trim() });
      }

      const heading = headingMatch[1].trim();
      current = {
        type: getSectionType(heading),
        heading,
        content: "",
      };
      continue;
    }

    if (!current) {
      current = {
        type: "plain",
        heading: "Odpowiedź",
        content: "",
      };
    }

    current.content += `${line}\n`;
  }

  if (current) {
    sections.push({ ...current, content: current.content.trim() });
  }

  return sections.filter((section) => section.heading || section.content);
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a href={part} key={`${part}-${index}`} rel="noreferrer" target="_blank">
              {part}
            </a>
          );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function ReactRenderer({ content }: { content: string }) {
  const sections = useMemo(() => parseReactSections(content), [content]);

  return (
    <>
      {sections.map((section, index) => (
        <section
          className={`react-section ${section.type}`}
          key={`${section.heading}-${index}`}
        >
          <h3 className="react-heading">{section.heading}</h3>
          {section.content ? (
            <div className="section-content">
              <LinkifiedText text={section.content} />
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}

function createChatMessage(
  role: ReactChatMessage["role"],
  content: string,
): ReactChatMessage {
  return { id: crypto.randomUUID(), role, content };
}

async function requestAgentResponse(body: string, signal: AbortSignal) {
  const request = () =>
    authenticatedFetch("/api/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });

  try {
    return await request();
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 400));
    return request();
  }
}

export default function ReactPage() {
  const [messages, setMessages] = useState<ReactChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [modelMode, setModelMode] = useState<ModelMode>("flash");
  const [copied, setCopied] = useState(false);
  const hasHydrated = useSyncExternalStore(
    subscribeToHydrationStore,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const abortRef = useRef<AbortController | null>(null);
  const welcomeShownRef = useRef(false);
  const { isProfileLoading, profile, profileError, userId } = useUserProfile();
  const {
    isMemoryBusy,
    isRestoringConversation,
    memoryError,
    startNewConversation,
  } = useReactSupabaseConversation({
    messages,
    setMessages,
    isGenerating: isLoading,
  });

  useEffect(() => {
    if (
      isProfileLoading ||
      isRestoringConversation ||
      profileError ||
      welcomeShownRef.current ||
      messages.length > 0
    ) {
      return;
    }

    welcomeShownRef.current = true;
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: profile?.name
          ? `### Wynik końcowy\nCześć, ${profile.name}! Miło Cię znowu widzieć. W czym mogę Ci dziś pomóc?`
          : "### Wynik końcowy\nCześć! Nie znamy się jeszcze. Jak masz na imię?",
      },
    ]);
  }, [isProfileLoading, isRestoringConversation, messages.length, profile?.name, profileError]);

  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const thoughtCount = latestAssistant
    ? Math.min(
        5,
        Math.max(
          1,
          (latestAssistant.content.match(/###\s+.*Myślę|###\s+.*Mysle/g) ?? [])
            .length,
        ),
      )
    : 0;
  const hasFinal = latestAssistant?.content.includes("Wynik końcowy") ?? false;
  const progressStep = hasFinal ? 5 : thoughtCount;
  const progressPercent = progressStep === 0 ? 0 : (progressStep / 5) * 100;
  const approxTokens = Math.ceil(
    messages.reduce((sum, message) => sum + message.content.length, 0) / 4,
  );

  async function sendGoal(goal: string) {
    const trimmed = goal.trim();

    if (!trimmed || isLoading || isProfileLoading || isRestoringConversation) {
      return;
    }

    setError("");
    setInput("");
    setIsLoading(true);

    const nextMessages: ReactChatMessage[] = [
      ...messages,
      createChatMessage("user", trimmed),
    ];
    const assistantMessageId = crypto.randomUUID();
    setMessages([...nextMessages, { id: assistantMessageId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45000);

    try {
      const response = await requestAgentResponse(
        JSON.stringify({ messages: nextMessages, modelMode, userId }),
        controller.signal,
      );

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Nie udało się uruchomić agenta.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        assistantContent += decoder.decode(value, { stream: true });
        setMessages([
          ...nextMessages,
          { id: assistantMessageId, role: "assistant", content: assistantContent },
        ]);
      }

      if (!assistantContent.trim()) {
        throw new Error(
          "Agent nie zwrócił treści. Sprawdź klucz GOOGLE_GENERATIVE_AI_API_KEY i log serwera.",
        );
      }
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        const message =
          caughtError.name === "AbortError" && timedOut
            ? "Agent przekroczył limit 45 sekund. Sprawdź konfigurację API i spróbuj ponownie."
            : caughtError.name === "AbortError"
              ? ""
              : "Nie udało się połączyć z agentem po automatycznym ponowieniu żądania.";

        if (message) {
          reportGeminiFallback(message, {
            fallbackModel: "brak automatycznego fallbacku",
            requestedModel: "gemini-3.1-flash-lite",
            source: "ReAct",
          });
          setError(message);
          setMessages([
            ...nextMessages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `### ⚠️ Błąd\n${message}`,
            },
          ]);
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendGoal(input);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    setIsLoading(false);
  }

  async function clearConversation() {
    abortRef.current?.abort();
    setInput("");
    setError("");
    setIsLoading(false);
    await startNewConversation();
  }

  async function exportConversation() {
    const text = messages
      .map((message) => `${message.role === "user" ? "User" : "Agent"}: ${message.content}`)
      .join("\n\n");

    await navigator.clipboard.writeText(text || "Brak wiadomości.");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="agent-shell">
      <section className="agent-board" aria-label="Agent ReAct">
        <header className="agent-header">
          <h1>🔄 Agent ReAct — Autonomiczne rozumowanie</h1>
          <p>Opisz cel → agent sam planuje i realizuje</p>
        </header>

        <section className="tools-panel" aria-label="Moje narzędzia">
          <h2>Moje narzędzia</h2>
          <div className="tools-grid">
            {tools.map((item) => (
              <div className="tool-chip" key={item.name}>
                <span>
                  <span aria-hidden="true">{item.icon}</span> {item.name}
                </span>
                <strong>aktywny</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="scenario-grid" aria-label="Scenariusze ReAct">
          {scenarios.map((scenario) => (
            <button
              className="scenario-tile"
              disabled={
                hasHydrated ? isLoading || isRestoringConversation : undefined
              }
              key={scenario}
              onClick={() => void sendGoal(scenario)}
              type="button"
            >
              {scenario}
            </button>
          ))}
        </section>

        <section className="context-panel" aria-label="Kontekst rozmowy">
          <div className="context-title">
            <h2>Kontekst rozmowy</h2>
            <span aria-hidden="true">▲</span>
          </div>
          <div className="context-row">
            <span>
              Wiadomości: {messages.length} | ~Tokeny: {approxTokens}
            </span>
            <div className="context-actions">
              <button
                disabled={
                  hasHydrated
                    ? isLoading || isMemoryBusy || (messages.length === 0 && !error)
                    : undefined
                }
                onClick={() => void clearConversation()}
                type="button"
              >
                🗑 Nowa rozmowa
              </button>
              <button onClick={() => void exportConversation()} type="button">
                📋 {copied ? "Skopiowano" : "Eksportuj rozmowę"}
              </button>
            </div>
          </div>
        </section>

        <section className="model-panel" aria-label="Model AI">
          <h2>Model AI</h2>
          <div className="model-toggle">
            <button
              className={modelMode === "flash" ? "active" : ""}
              onClick={() => setModelMode("flash")}
              type="button"
            >
              ⚡ Flash szybki
            </button>
            <button
              className={modelMode === "pro" ? "active" : ""}
              onClick={() => setModelMode("pro")}
              type="button"
            >
              🧠 Pro zaawansowany
            </button>
          </div>
        </section>

        <section className="chat-panel compact-chat" aria-label="Czat ReAct">
          <div className="progress-wrap">
            <div className="progress-label">
              <span>Krok {progressStep || 0} z 5</span>
              <span>{isLoading ? "Agent działa..." : hasFinal ? "Gotowe" : "Czeka na cel"}</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="messages">
            {isRestoringConversation ? (
              <div className="thinking" role="status">
                Wczytuję rozmowę...
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <p>Wybierz scenariusz albo wpisz cel, a agent rozpisze swoje kroki.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <span className="message-label">
                    {message.role === "user" ? "Ty" : "Agent ReAct"}
                  </span>
                  <div className="bubble">
                    {message.role === "assistant" ? (
                      message.content ? (
                        <ReactRenderer content={message.content} />
                      ) : (
                        <span>Rozpoczynam planowanie...</span>
                      )
                    ) : (
                      message.content
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          {error ? <div className="error-box">{error}</div> : null}
          {profileError ? (
            <div className="error-box">Profil Supabase: {profileError}</div>
          ) : null}
          {memoryError ? <div className="error-box">Historia Supabase: {memoryError}</div> : null}

          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              disabled={
                hasHydrated
                  ? isLoading || isProfileLoading || isRestoringConversation
                  : undefined
              }
              onChange={(event) => setInput(event.target.value)}
              placeholder="Opisz co chcesz osiągnąć..."
              value={input}
            />
            {isLoading ? (
              <button className="send-button" onClick={stopGeneration} type="button">
                Stop
              </button>
            ) : (
              <button
                className="send-button"
                disabled={
                  hasHydrated
                    ? !input.trim() || isProfileLoading || isRestoringConversation
                    : undefined
                }
                type="submit"
              >
                Wyślij
              </button>
            )}
          </form>
        </section>
      </section>
    </main>
  );
}
