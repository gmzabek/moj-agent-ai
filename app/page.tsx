"use client";

import { LandingPage } from "./components/LandingPage";
import { WorkshopChat } from "./components/WorkshopChat";
import { useAuth } from "./components/AuthProvider";

const chatExamples = [
  "Jakie są najważniejsze informacje w dokumentach mojej firmy?",
  "Przygotuj podsumowanie ostatniej rozmowy.",
  "Pomóż mi zaplanować działania na ten tydzień.",
  "Znajdź odpowiedź w mojej bazie wiedzy.",
];

export default function HomePage() {
  const { user } = useAuth();

  if (!user) {
    return <LandingPage />;
  }

  return (
    <WorkshopChat
      title="💬 LEO"
      subtitle="Twój osobisty asystent z pamięcią i firmową bazą wiedzy."
      endpoint="/api/chat"
      placeholder="O co chcesz zapytać LEO?"
      storageKey="atlas-home-chat-history"
      examples={chatExamples}
      exampleMode="send"
      enableUserProfile
      renderMarkdown
      emptyText="Wybierz przykład albo rozpocznij własną rozmowę."
    />
  );
}
