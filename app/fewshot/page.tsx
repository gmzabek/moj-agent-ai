import { WorkshopChat } from "../components/WorkshopChat";

const examples = [
  "Sztuczna inteligencja",
  "Agent AI",
  "Prompt",
  "Halucynacja AI",
  "RAG",
  "API",
];

export default function FewshotPage() {
  return (
    <WorkshopChat
      title="📚 Słownik AI"
      subtitle="Wyjaśniam trudne pojęcia prostym językiem."
      endpoint="/api/fewshot"
      placeholder="Wpisz pojęcie do wyjaśnienia..."
      storageKey="leo-fewshot-history"
      examples={examples}
      exampleMode="insert"
      emptyText="Wybierz pojęcie albo wpisz własny termin do wyjaśnienia."
    />
  );
}
