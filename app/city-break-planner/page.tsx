import { CityBreakPlanner } from "./CityBreakPlanner";

export default function CityBreakPlannerPage() {
  return (
    <main className="city-break-shell">
      <header className="city-break-header">
        <p className="eyebrow">Funkcja agenta</p>
        <h1>City Break Planner</h1>
        <p>
          Automatyczny plan zwiedzania miasta na jeden lub dwa dni dla dwóch
          osób, z atrakcjami, trasą, transportem, gastronomią i kosztorysem.
        </p>
      </header>

      <section className="city-break-grid" aria-label="City Break Planner">
        <CityBreakPlanner />
      </section>
    </main>
  );
}
