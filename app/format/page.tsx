import { WorkshopChat } from "../components/WorkshopChat";

const examples = [
  "/tabela języki programowania 2026",
  "/porownanie ChatGPT vs Claude",
  "/lista 5 kroków do pierwszego agenta AI",
  "/faq sztuczna inteligencja dla początkujących",
  "/email podziękowanie za udaną rekrutację",
];

export default function FormatPage() {
  return (
    <WorkshopChat
      title="📐 Formatowanie"
      subtitle="Agent odpowiada w tabeli, liście, porównaniu - na żądanie."
      endpoint="/api/format"
      placeholder="Wpisz komendę, np. /tabela porównanie modeli AI..."
      storageKey="leo-format-history"
      examples={examples}
      exampleMode="insert"
      renderMarkdown
      emptyText="Kliknij komendę, dopasuj ją do siebie i wyślij."
    />
  );
}
