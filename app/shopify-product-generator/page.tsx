"use client";

import { useState } from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";

type Product = { name: string; url: string; category: string; price: string; images: string[]; documentsPdf: string[] };

export default function ShopifyProductGeneratorPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function crawlProducts() {
    if (isLoading) return;
    setIsLoading(true); setError("");
    try {
      const response = await authenticatedFetch("/api/batrea-crawler", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ maxProducts: 20 }) });
      const data = await response.json().catch(() => null) as { error?: string; products?: Product[] } | null;
      if (!response.ok || !data?.products) throw new Error(data?.error || "Crawler nie zwrócił produktów.");
      setProducts(data.products);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Crawler nie ukończył pracy."); }
    finally { setIsLoading(false); }
  }

  return <main className="shell"><header className="react-header"><p className="eyebrow">PLAYWRIGHT CRAWLER</p><h1>🛡️ Shopify product generator</h1><p>Crawl produktów Batrea renderowanych w JavaScript: opisy, specyfikacje, ceny, warianty, obrazy i dokumenty PDF.</p></header><section className="side-panel"><h2>Eksport danych źródłowych</h2><p>Respektuje robots.txt i ogranicza tempo do jednego żądania na sekundę.</p><button className="send-button" disabled={isLoading} onClick={() => void crawlProducts()} type="button">{isLoading ? "Crawluję katalog…" : "Pobierz produkty Batrea"}</button></section>{error ? <p className="error-box">{error}</p> : null}{products.length > 0 ? <section className="side-panel" style={{ marginTop: "1rem" }}><h2>Zebrane produkty ({products.length})</h2><ul>{products.map((product) => <li key={product.url} style={{ margin: "1rem 0" }}><strong>{product.name}</strong><br /><small>{product.category} · {product.price}</small><br /><a href={product.url} rel="noreferrer" target="_blank">Źródło</a><br /><small>{product.images.length} obrazów · {product.documentsPdf.length} PDF</small></li>)}</ul></section> : null}</main>;
}
