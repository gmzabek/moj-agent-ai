"use client";

import { FormEvent, useState } from "react";
import * as XLSX from "xlsx";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import { MarkdownView } from "../components/MarkdownView";

type MatrixifyRow = Record<string, string>;

const matrixifyColumns = [
  "Handle", "Command", "Title", "Body HTML", "Vendor", "Type", "Tags", "Category: Name", "Image Src", "Image Position", "Image Alt Text",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value", "Variant SKU", "Variant Barcode",
  "Variant Price", "Variant Compare At Price", "Variant Cost", "Variant Weight", "Variant Weight Unit", "SEO Title", "SEO Description", "Status", "Published",
  "Metafield: custom.breadcrumbs", "Metafield: custom.oswietlenie", "Metafield: custom.dodatkowe_informacje", "Metafield: custom.wysylka", "Metafield: custom.rodzaj_zamka", "Metafield: custom.rodzaj_broni", "Metafield: custom.ognioodpornosc", "Metafield: custom.wielkosc_sejfu", "Metafield: custom.klasa_bezpieczenstwa", "Metafield: custom.ilosc_uchwytow_na_bron", "Metafield: custom.waga", "Metafield: custom.wymiary_zewnetrzne", "Metafield: custom.wymiary_wewnetrzne", "Metafield: custom.klasa_antywlamaniowa", "Metafield: custom.otwory_do_montazu", "Metafield: custom.kat_otwarcia_drzwi", "Metafield: custom.korpus", "Metafield: custom.drzwi", "Metafield: custom.rodzaj_zamkniecia",
];

export default function ShopifyProductGeneratorPage() {
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [matrixifyRows, setMatrixifyRows] = useState<MatrixifyRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (loading || (!sourceUrl && !sourceText && !pdfFile)) return;

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("sourceUrl", sourceUrl);
      formData.append("sourceText", sourceText);
      if (pdfFile) formData.append("pdf", pdfFile);

      const response = await authenticatedFetch("/api/shopify-product-content", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { error?: string; content?: string; matrixifyRows?: MatrixifyRow[] } | null;

      if (!response.ok || !data?.content || !data.matrixifyRows?.length) {
        throw new Error(data?.error || "Nie udało się wygenerować treści.");
      }

      setContent(data.content);
      setMatrixifyRows(data.matrixifyRows);
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

  function exportMatrixify(format: "xlsx" | "csv") {
    const worksheet = XLSX.utils.json_to_sheet(matrixifyRows, { header: matrixifyColumns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, `shopify-matrixify.${format}`, { bookType: format });
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
        <label>
          Karta katalogowa lub certyfikat PDF (opcjonalnie, maks. 10 MB)
          <input accept="application/pdf,.pdf" onChange={(event) => setPdfFile(event.target.files?.[0] || null)} type="file" />
        </label>
        {pdfFile ? <p className="muted">Załączono: {pdfFile.name}</p> : null}
        <p className="muted">Brakujące parametry są oznaczane jako „brak danych – do uzupełnienia”; generator ich nie dopowiada.</p>
        <button className="send-button" disabled={loading || (!sourceUrl && !sourceText && !pdfFile)}>
          {loading ? "Generuję…" : "Wygeneruj treść produktu"}
        </button>
      </form>

      {error ? <p className="error-box">{error}</p> : null}

      {content ? (
        <section className="side-panel" style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
            <h2>Gotowa karta produktu</h2>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <button className="secondary-button" onClick={() => void copyContent()} type="button">{copied ? "Skopiowano" : "Kopiuj całość"}</button>
              <button className="secondary-button" onClick={() => exportMatrixify("xlsx")} type="button">Eksportuj XLSX</button>
              <button className="secondary-button" onClick={() => exportMatrixify("csv")} type="button">Eksportuj CSV Matrixify</button>
            </div>
          </div>
          <MarkdownView text={content} />
        </section>
      ) : null}
    </main>
  );
}
