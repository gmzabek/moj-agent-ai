"use client";

import { FormEvent, useState } from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import { MarkdownView } from "../components/MarkdownView";

export default function ShopifyProductGeneratorPage() {
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (loading || (!sourceUrl && !sourceText)) return;

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const response = await authenticatedFetch("/api/shopify-product-content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, sourceUrl, sourceText }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; content?: string } | null;

      if (!response.ok || !data?.content) {
        throw new Error(data?.error || "Nie udało się wygenerować treści.");
      }

      setContent(data.content);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Błąd generatora.");
    } finally {
      setLoading(false);
    }
  }

  async function copyContent() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
  }

  return (
    <main className="shell">
      <header className="react-header">
        <p className="eyebrow">SHOPIFY CONTENT</p>
        <h1>🛡️ Shopify product generator</h1>
        <p>Przygotowuje polską kartę produktu dla Shopify/Matrixify wyłącznie na podstawie podanych danych producenta.</p>
      </header>

      <form className="side-panel" onSubmit={generate}>
        <label>
          Nazwa/model produktu
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Np. Sejf na broń ABC 12" />
        </label>
        <label>
          URL producenta (opcjonalnie)
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://producent.pl/produkt/..." />
        </label>
        <label>
          Surowe dane techniczne lub tekst z karty katalogowej/PDF
          <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Wymiary, waga, klasa, zamek, certyfikaty, opis, warianty…" />
        </label>
        <p className="muted">Brakujące parametry są oznaczane jako „brak danych – do uzupełnienia”; generator ich nie dopowiada.</p>
        <button className="send-button" disabled={loading || (!sourceUrl && !sourceText)}>
          {loading ? "Generuję…" : "Wygeneruj treść produktu"}
        </button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}

      {content ? (
        <section className="side-panel" style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
            <h2>Gotowa karta produktu</h2>
            <button className="secondary-button" onClick={() => void copyContent()} type="button">
              {copied ? "Skopiowano" : "Kopiuj całość"}
            </button>
          </div>
          <MarkdownView text={content} />
        </section>
      ) : null}
    </main>
  );
}
