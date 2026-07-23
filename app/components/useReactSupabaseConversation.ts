"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

export type ReactChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UseReactSupabaseConversationOptions = {
  messages: ReactChatMessage[];
  setMessages: (messages: ReactChatMessage[]) => void;
  isGenerating: boolean;
};

function createConversationTitle(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return "Nowa rozmowa";
  }

  return normalizedText.length > 50
    ? `${normalizedText.slice(0, 47)}...`
    : normalizedText;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useReactSupabaseConversation({
  messages,
  setMessages,
  isGenerating,
}: UseReactSupabaseConversationOptions) {
  const [isRestoringConversation, setIsRestoringConversation] = useState(true);
  const [isMemoryBusy, setIsMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const savedMessageIdsRef = useRef(new Set<string>());
  const savingMessageIdsRef = useRef(new Set<string>());
  const ignoredMessageIdsRef = useRef(new Set<string>());
  const isRestoringRef = useRef(true);
  const hasUserMessageRef = useRef(false);

  const createConversation = useCallback(async (title: string) => {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ title, updated_at: new Date().toISOString() })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    conversationIdRef.current = data.id;
    return data.id as string;
  }, []);

  const ensureConversation = useCallback(
    async (title: string) => conversationIdRef.current ?? createConversation(title),
    [createConversation],
  );

  const startNewConversation = useCallback(async () => {
    setIsMemoryBusy(true);
    setMemoryError(null);
    setMessages([]);
    conversationIdRef.current = null;
    savedMessageIdsRef.current = new Set();
    savingMessageIdsRef.current = new Set();
    ignoredMessageIdsRef.current = new Set();
    hasUserMessageRef.current = false;

    try {
      await createConversation("Nowa rozmowa");
    } catch (error) {
      setMemoryError(getErrorMessage(error, "Nie udało się utworzyć rozmowy w Supabase."));
    } finally {
      setIsMemoryBusy(false);
    }
  }, [createConversation, setMessages]);

  useEffect(() => {
    let isCancelled = false;

    async function restoreConversation() {
      setIsRestoringConversation(true);
      isRestoringRef.current = true;
      setMemoryError(null);

      try {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("id")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

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

        const restoredMessages = (dbMessages ?? []) as ReactChatMessage[];
        conversationIdRef.current = conversation.id;
        savedMessageIdsRef.current = new Set(restoredMessages.map((message) => message.id));
        hasUserMessageRef.current = restoredMessages.some((message) => message.role === "user");
        setMessages(restoredMessages);
      } catch (error) {
        if (!isCancelled) {
          setMemoryError(getErrorMessage(error, "Nie udało się wczytać historii z Supabase."));
        }
      } finally {
        if (!isCancelled) {
          isRestoringRef.current = false;
          setIsRestoringConversation(false);
        }
      }
    }

    void restoreConversation();

    return () => {
      isCancelled = true;
    };
  }, [setMessages]);

  useEffect(() => {
    if (isRestoringRef.current) {
      return;
    }

    const messagesToSave = messages.filter((message) => {
      const canSaveMessage = message.content.trim().length > 0;
      const isStreamingAssistant = isGenerating && message.role === "assistant";
      const isGreetingBeforeFirstQuestion =
        message.role === "assistant" && !hasUserMessageRef.current;

      if (isGreetingBeforeFirstQuestion) {
        ignoredMessageIdsRef.current.add(message.id);
      }

      return (
        canSaveMessage &&
        !isStreamingAssistant &&
        !isGreetingBeforeFirstQuestion &&
        !ignoredMessageIdsRef.current.has(message.id) &&
        !savedMessageIdsRef.current.has(message.id) &&
        !savingMessageIdsRef.current.has(message.id)
      );
    });

    if (messagesToSave.length === 0) {
      return;
    }

    let isCancelled = false;

    async function saveMessages() {
      for (const message of messagesToSave) {
        savingMessageIdsRef.current.add(message.id);

        try {
          const conversationId = await ensureConversation(createConversationTitle(message.content));

          if (isCancelled) {
            return;
          }

          const { error: insertError } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: message.role,
            content: message.content,
          });

          if (insertError) {
            throw insertError;
          }

          const updatePayload =
            message.role === "user" && !hasUserMessageRef.current
              ? { title: createConversationTitle(message.content), updated_at: new Date().toISOString() }
              : { updated_at: new Date().toISOString() };
          const { error: updateError } = await supabase
            .from("conversations")
            .update(updatePayload)
            .eq("id", conversationId);

          if (updateError) {
            throw updateError;
          }

          if (message.role === "user") {
            hasUserMessageRef.current = true;
          }

          savedMessageIdsRef.current.add(message.id);
          setMemoryError(null);
        } catch (error) {
          setMemoryError(getErrorMessage(error, "Nie udało się zapisać wiadomości w Supabase."));
        } finally {
          savingMessageIdsRef.current.delete(message.id);
        }
      }
    }

    void saveMessages();

    return () => {
      isCancelled = true;
    };
  }, [ensureConversation, isGenerating, messages]);

  return {
    isMemoryBusy: isMemoryBusy || isRestoringConversation,
    isRestoringConversation,
    memoryError,
    startNewConversation,
  };
}
