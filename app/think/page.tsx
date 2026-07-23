import { WorkshopChat } from "../components/WorkshopChat";

export default function ThinkPage() {
  return (
    <WorkshopChat
      title="🧠 Tryb głębokiego myślenia"
      subtitle="Agent pokazuje tok rozumowania krok po kroku."
      endpoint="/api/think"
      placeholder="Zadaj trudne pytanie..."
      storageKey="leo-think-history"
      emptyText="Zadaj pytanie wymagające analizy, obliczeń albo porównania."
      renderMarkdown
    />
  );
}
