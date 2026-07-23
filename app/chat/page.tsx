import { WorkshopChat } from "../components/WorkshopChat";

const examples = [
  "Jak zautomatyzować obsługę zamówień między sklepem, ERP i kurierami?",
  "Które procesy w e-commerce warto najpierw usprawnić AI?",
  "Jak policzyć opłacalność automatyzacji obsługi klienta?",
  "Jak zaprojektować integrację BaseLinker, CRM i magazynu?",
];

export default function ChatPage() {
  return (
    <WorkshopChat
      title="💬 Chat"
      subtitle="Rozmowa z agentem. ReAct i pozostałe funkcje są trybami pracy nadrzędnego agenta."
      endpoint="/api/chat"
      placeholder="Napisz wiadomość..."
      storageKey="leo-chat-history"
      examples={examples}
      exampleMode="send"
      enableUserProfile
      renderMarkdown
      emptyText="Wybierz przykład albo napisz własne pytanie."
    />
  );
}
