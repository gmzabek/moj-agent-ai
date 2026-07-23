"use client";

import { type UIMessage } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type ChatStatus = "submitted" | "streaming" | "ready" | "error" | string;

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UseSupabaseConversationOptions = {
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  status: ChatStatus;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function createConversationTitle(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return "Nowa rozmowa";
  }

  return normalizedText.length > 50
    ? `${normalizedText.slice(0, 47)}...`
    : normalizedText;
}

function getSupabaseErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function dbMessageToUiMessage(message: DbMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  };
}

export function useSupabaseConversation({
  messages,
  setMessages,
  status,
}: UseSupabaseConversationOptions) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRestoringConversation, setIsRestoringConversation] = useState(true);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const createConversationPromiseRef = useRef<Promise<string> | null>(null);
  const hasUserMessageRef = useRef(false);
  const isRestoringRef = useRef(true);
  const savedMessageIdsRef = useRef(new Set<string>());
  const savingMessageIdsRef = useRef(new Set<string>());
  const ignoredMessageIdsRef = useRef(new Set<string>());

  const createConversation = useCallback(async (title: string) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ title, updated_at: now })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    conversationIdRef.current = data.id;
    setConversationId(data.id);

    return data.id as string;
  }, []);

  const ensureConversation = useCallback(
    async (title: string) => {
      if (conversationIdRef.current) {
        return conversationIdRef.current;
      }

      if (!createConversationPromiseRef.current) {
        createConversationPromiseRef.current = createConversation(title).finally(() => {
          createConversationPromiseRef.current = null;
        });
      }

      return createConversationPromiseRef.current;
    },
    [createConversation],
  );

  const startNewConversation = useCallback(async () => {
    setIsStartingConversation(true);
    setMemoryError(null);
    setMessages([]);
    conversationIdRef.current = null;
    setConversationId(null);
    hasUserMessageRef.current = false;
    savedMessageIdsRef.current = new Set();
    savingMessageIdsRef.current = new Set();
    ignoredMessageIdsRef.current = new Set();

    try {
      await createConversation("Nowa rozmowa");
    } catch (error) {
      setMemoryError(
        getSupabaseErrorMessage(
          error,
          "Nie udało się utworzyć nowej rozmowy w Supabase.",
        ),
      );
    } finally {
      setIsStartingConversation(false);
    }
  }, [createConversation, setMessages]);

  useEffect(() => {
    let isCancelled = false;

    async function restoreLatestConversation() {
      isRestoringRef.current = true;
      setIsRestoringConversation(true);
      setMemoryError(null);

      try {
        const requestedConversationId = new URLSearchParams(
          window.location.search,
        ).get("conversation");
        let conversationQuery = supabase
          .from("conversations")
          .select("id");

        if (requestedConversationId) {
          conversationQuery = conversationQuery.eq("id", requestedConversationId);
        } else {
          conversationQuery = conversationQuery
            .order("updated_at", { ascending: false })
            .limit(1);
        }

        const { data: conversation, error: conversationError } =
          await conversationQuery.maybeSingle();

        if (conversationError) {
          throw conversationError;
        }

        if (!conversation) {
          return;
        }

        const { data: dbMessages, error: messagesError } = await supabase
          .from("messages")
          .select("id, role, content")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });

        if (messagesError) {
          throw messagesError;
        }

        if (isCancelled) {
          return;
        }

        const restoredMessages = (dbMessages ?? []).map((message) =>
          dbMessageToUiMessage(message as DbMessage),
        );

        conversationIdRef.current = conversation.id;
        setConversationId(conversation.id);
        hasUserMessageRef.current = restoredMessages.some(
          (message) => message.role === "user",
        );
        savedMessageIdsRef.current = new Set(
          restoredMessages.map((message) => message.id),
        );
        setMessages(restoredMessages);
      } catch (error) {
        if (!isCancelled) {
          setMemoryError(
            getSupabaseErrorMessage(
              error,
              "Nie udało się wczytać rozmowy z Supabase.",
            ),
          );
        }
      } finally {
        if (!isCancelled) {
          isRestoringRef.current = false;
          setIsRestoringConversation(false);
        }
      }
    }

    void restoreLatestConversation();

    return () => {
      isCancelled = true;
    };
  }, [setMessages]);

  useEffect(() => {
    if (isRestoringRef.current) {
      return;
    }

    let isCancelled = false;
    const isAnswerStreaming = status === "submitted" || status === "streaming";
    const lastMessageId = messages.at(-1)?.id;
    const messagesToSave = messages.filter((message) => {
      const roleCanBeSaved =
        message.role === "user" || message.role === "assistant";
      const content = getMessageText(message);
      const isLatestStreamingAssistant =
        isAnswerStreaming && message.role === "assistant" && message.id === lastMessageId;
      const isInitialGreeting = message.role === "assistant" && !hasUserMessageRef.current;

      if (isInitialGreeting) {
        ignoredMessageIdsRef.current.add(message.id);
      }

      return (
        roleCanBeSaved &&
        content.length > 0 &&
        !isLatestStreamingAssistant &&
        !isInitialGreeting &&
        !ignoredMessageIdsRef.current.has(message.id) &&
        !savedMessageIdsRef.current.has(message.id) &&
        !savingMessageIdsRef.current.has(message.id)
      );
    });

    if (messagesToSave.length === 0) {
      return;
    }

    async function saveMessages() {
      for (const message of messagesToSave) {
        if (isCancelled) {
          return;
        }

        savingMessageIdsRef.current.add(message.id);

        try {
          const content = getMessageText(message);
          const title = createConversationTitle(content);
          const currentConversationId = await ensureConversation(title);

          if (isCancelled) {
            return;
          }

          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id: currentConversationId,
            role: message.role,
            content,
          });

          if (insertError) {
            throw insertError;
          }

          const shouldSetTitle =
            message.role === "user" && !hasUserMessageRef.current;
          const updatePayload = shouldSetTitle
            ? { title, updated_at: new Date().toISOString() }
            : { updated_at: new Date().toISOString() };
          const { error: updateError } = await supabase
            .from("conversations")
            .update(updatePayload)
            .eq("id", currentConversationId);

          if (updateError) {
            throw updateError;
          }

          if (message.role === "user") {
            hasUserMessageRef.current = true;
          }

          savedMessageIdsRef.current.add(message.id);
          setMemoryError(null);
        } catch (error) {
          setMemoryError(
            getSupabaseErrorMessage(
              error,
              "Nie udało się zapisać wiadomości w Supabase.",
            ),
          );
        } finally {
          savingMessageIdsRef.current.delete(message.id);
        }
      }
    }

    void saveMessages();

    return () => {
      isCancelled = true;
    };
  }, [ensureConversation, messages, status]);

  return {
    conversationId,
    isMemoryBusy: isRestoringConversation || isStartingConversation,
    isRestoringConversation,
    isStartingConversation,
    memoryError,
    startNewConversation,
  };
}
