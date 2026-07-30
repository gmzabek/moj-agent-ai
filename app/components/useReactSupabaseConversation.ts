"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

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
  const { user } = useAuth();
  const [isRestoringConversation, setIsRestoringConversation] = useState(true);
  const [isMemoryBusy, setIsMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const conversationUserIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef(user?.id ?? null);
  const createConversationPromiseRef = useRef<Promise<string> | null>(null);
  const savedMessageIdsRef = useRef(new Set<string>());
  const savingMessageIdsRef = useRef(new Set<string>());
  const ignoredMessageIdsRef = useRef(new Set<string>());
  const saveQueueRef = useRef(Promise.resolve());
  const isRestoringRef = useRef(true);
  const hasUserMessageRef = useRef(false);

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const createConversation = useCallback(async (title: string) => {
    if (!user) {
      throw new Error("Zaloguj się, aby zapisać rozmowę.");
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        title,
        updated_at: new Date().toISOString(),
        user_id: user.id,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    if (currentUserIdRef.current !== user.id) {
      throw new Error("Użytkownik zmienił się podczas zapisu rozmowy.");
    }

    conversationIdRef.current = data.id;
    conversationUserIdRef.current = user.id;
    return data.id as string;
  }, [user]);

  const ensureConversation = useCallback(
    async (title: string) => {
      if (
        conversationIdRef.current &&
        conversationUserIdRef.current === user?.id
      ) {
        return conversationIdRef.current;
      }

      conversationIdRef.current = null;
      conversationUserIdRef.current = null;

      if (!createConversationPromiseRef.current) {
        const createPromise = createConversation(title).finally(() => {
          if (createConversationPromiseRef.current === createPromise) {
            createConversationPromiseRef.current = null;
          }
        });
        createConversationPromiseRef.current = createPromise;
      }

      return createConversationPromiseRef.current;
    },
    [createConversation, user?.id],
  );

  const startNewConversation = useCallback(async () => {
    setIsMemoryBusy(true);
    setMemoryError(null);
    setMessages([]);
    conversationIdRef.current = null;
    conversationUserIdRef.current = null;
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
      if (!user) {
        return;
      }

      setIsRestoringConversation(true);
      isRestoringRef.current = true;
      setMemoryError(null);
      conversationIdRef.current = null;
      conversationUserIdRef.current = null;
      createConversationPromiseRef.current = null;
      hasUserMessageRef.current = false;
      savedMessageIdsRef.current = new Set();
      savingMessageIdsRef.current = new Set();
      ignoredMessageIdsRef.current = new Set();
      setMessages([]);

      try {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("id")
          .eq("user_id", user.id)
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
        conversationUserIdRef.current = user.id;
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
  }, [setMessages, user]);

  useEffect(() => {
    if (isRestoringRef.current) {
      return;
    }

    const hasAnyUserMessage = messages.some(
      (message) =>
        message.role === "user" && message.content.trim().length > 0,
    );
    const messagesToSave = messages.filter((message) => {
      const canSaveMessage = message.content.trim().length > 0;
      const isStreamingAssistant = isGenerating && message.role === "assistant";
      const isGreetingBeforeFirstQuestion =
        message.role === "assistant" && !hasAnyUserMessage;

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

    for (const message of messagesToSave) {
      savingMessageIdsRef.current.add(message.id);
    }

    async function saveMessages() {
      const saveUserId = user?.id;

      for (const message of messagesToSave) {
        try {
          if (!saveUserId || currentUserIdRef.current !== saveUserId) {
            continue;
          }

          const conversationId = await ensureConversation(createConversationTitle(message.content));

          if (currentUserIdRef.current !== saveUserId) {
            continue;
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
            .eq("id", conversationId)
            .eq("user_id", user?.id ?? "");

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

    saveQueueRef.current = saveQueueRef.current.then(saveMessages, saveMessages);
  }, [ensureConversation, isGenerating, messages, user]);

  return {
    isMemoryBusy: isMemoryBusy || isRestoringConversation,
    isRestoringConversation,
    memoryError,
    startNewConversation,
  };
}
