"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import { MarkdownView } from "../components/MarkdownView";
import styles from "./MealPlanner.module.css";

const examples = [
  "Wegetariańsko, bez orzechów. Szybkie dania do 30 minut, budżetowo, dużo warzyw sezonowych.",
  "Dieta śródziemnomorska dla rodziny. Bez laktozy, ryby maksymalnie 2 razy w tygodniu, dania przyjazne dzieciom.",
];

export default function MealPlannerPage() {
  const [diet, setDiet] = useState("Zbilansowana");
  const [preferences, setPreferences] = useState("");
  const [servings, setServings] = useState(2);
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preferences.trim().length < 5 || loading) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true); setError(""); setPlan(""); setCopied(false);
    try {
      const response = await authenticatedFetch("/api/meal-planner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ diet, preferences: preferences.trim(), servings }), signal: controller.signal });
      const data = !response.ok ? await response.json().catch(() => null) as { error?: string } | null : null;
      if (!response.ok) throw new Error(data?.error || "Nie udało się przygotować planu.");
      if (!response.body) throw new Error("Serwer nie zwrócił odpowiedzi.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = "";
      while (true) { const { done, value } = await reader.read(); if (done) { text += decoder.decode(); break; } text += decoder.decode(value, { stream: true }); setPlan(text); }
      if (!text.trim()) throw new Error("Model nie przygotował planu.");
      setPlan(text);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Nie udało się przygotować planu.");
    } finally { if (controllerRef.current === controller) { controllerRef.current = null; setLoading(false); } }
  }

  async function copyPlan() { try { await navigator.clipboard.writeText(plan); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setError("Nie udało się skopiować planu."); } }

  return <main className={styles.page}>
    <header><span>WŁASNY SCENARIUSZ</span><h1>🍽️ Planer posiłków</h1><p>Podaj preferencje, a agent przygotuje tydzień posiłków z przepisami i listą zakupów.</p></header>
    <form className={styles.card} onSubmit={submit}>
      <div className={styles.grid}><label>Dieta<select value={diet} onChange={(e) => setDiet(e.target.value)} disabled={loading}><option>Zbilansowana</option><option>Wegetariańska</option><option>Wegańska</option><option>Śródziemnomorska</option><option>Bez laktozy</option><option>Bez glutenu</option></select></label><label>Liczba osób<input type="number" min="1" max="12" value={servings} disabled={loading} onChange={(e) => setServings(Number(e.target.value) || 1)} /></label></div>
      <label>Preferencje, alergie i ograniczenia<textarea value={preferences} disabled={loading} onChange={(e) => setPreferences(e.target.value)} placeholder="Np. bez orzechów, szybkie dania do 30 minut, budżet 500 zł, lubię kuchnię włoską..." /></label>
      <div className={styles.actions}><div>{examples.map((x) => <button key={x} type="button" disabled={loading} onClick={() => setPreferences(x)}>Przykład</button>)}</div><button className={styles.primary} disabled={loading || preferences.trim().length < 5}>{loading ? "Układam jadłospis…" : "🍽️ Zaplanuj tydzień"}</button></div>
    </form>
    {error && <p className={styles.error}>{error}</p>}
    {loading && <p className={styles.progress}>Agent układa posiłki i listę zakupów… <button type="button" onClick={() => controllerRef.current?.abort()}>Anuluj</button></p>}
    {plan && <section className={styles.result}><header><div><span>GOTOWY PLAN</span><h2>Twój tydzień</h2></div><button onClick={() => void copyPlan()}>{copied ? "✓ Skopiowano" : "📋 Kopiuj"}</button></header><article><MarkdownView text={plan} /></article></section>}
  </main>;
}
