import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell home-shell">
      <section className="home-hero">
        <p className="eyebrow">Lekcja 04</p>
        <h1>Agent AI</h1>
        <p>
          Nadrzędne centrum funkcji AI: planowanie podróży, ReAct, rozmowa,
          wyszukiwanie, analiza i generowanie treści.
        </p>
        <Link className="primary-link" href="/agent">
          Otwórz agenta
        </Link>
      </section>
    </main>
  );
}
