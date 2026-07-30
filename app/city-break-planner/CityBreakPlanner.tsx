"use client";

import { FormEvent, useState } from "react";
import { reportGeminiFallback } from "../components/geminiFallbackStatus";
import { MarkdownView } from "../components/MarkdownView";

type CityBreakResponse = {
  plan?: string;
  error?: string;
};

export function CityBreakPlanner() {
  const [city, setCity] = useState("Berlin");
  const [days, setDays] = useState(2);
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const estimatedCost = days === 1 ? "400-650 PLN" : "750-1200 PLN";
  const routeLength = days === 1 ? "5-8 km" : "8-14 km";

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cityName = city.trim();

    if (!cityName || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setPlan("");

    try {
      const response = await fetch("/api/city-break", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city: cityName,
          days,
          travelers: 2,
        }),
      });
      const data = (await response.json()) as CityBreakResponse;

      if (!response.ok || !data.plan) {
        throw new Error(data.error || "Nie udało się wygenerować planu.");
      }

      setPlan(data.plan);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udało się wygenerować planu.";

      reportGeminiFallback(message, {
        fallbackModel: "brak automatycznego fallbacku",
        requestedModel: "gemini-3.1-flash-lite",
        source: "City Break Planner",
      });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <article className="planner-card city-break-card">
      <div className="card-map" aria-hidden="true">
        <span>📍</span>
      </div>

      <div className="card-head">
        <div>
          <h2>📍 City Break Planner</h2>
          <p>Kompletny plan zwiedzania miasta dla dwóch osób.</p>
        </div>
      </div>

      <div className="metric-grid" aria-label="Zakres planu">
        <div>
          <strong>5</strong>
          <span>atrakcji</span>
        </div>
        <div>
          <strong>{estimatedCost}</strong>
          <span>koszt dla 2 osób</span>
        </div>
        <div>
          <strong>{routeLength}</strong>
          <span>długość trasy</span>
        </div>
        <div>
          <strong>3</strong>
          <span>restauracje</span>
        </div>
      </div>

      <form className="city-break-form" onSubmit={generatePlan}>
        <label>
          Miasto
          <input
            disabled={isLoading}
            onChange={(event) => setCity(event.target.value)}
            placeholder="np. Berlin, Kraków, Wiedeń"
            value={city}
          />
        </label>

        <div className="day-toggle" aria-label="Długość wyjazdu">
          <button
            className={days === 1 ? "active" : ""}
            disabled={isLoading}
            onClick={() => setDays(1)}
            type="button"
          >
            1 dzień
          </button>
          <button
            className={days === 2 ? "active" : ""}
            disabled={isLoading}
            onClick={() => setDays(2)}
            type="button"
          >
            2 dni
          </button>
        </div>

        <button className="primary-link" disabled={isLoading || !city.trim()} type="submit">
          {isLoading ? "Generuję plan..." : "Generuj plan"}
        </button>
      </form>

      {error ? <p className="planner-error">{error}</p> : null}

      {plan ? (
        <section className="planner-result" aria-label="Wygenerowany plan">
          <MarkdownView text={plan} />
        </section>
      ) : null}
    </article>
  );
}
