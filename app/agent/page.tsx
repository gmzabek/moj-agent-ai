"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const exchangeRates = [
  { code: "EUR", delta: "0.0013", value: "4.3262 PLN" },
  { code: "USD", delta: "0.0148", value: "3.7731 PLN" },
];

const holidays = [
  { date: "15 sie", name: "Wniebowzięcie Najświętszej Maryi Panny" },
  { date: "1 lis", name: "Wszystkich Świętych" },
  { date: "11 lis", name: "Narodowe Święto Niepodległości" },
  { date: "24 gru", name: "Wigilia Bożego Narodzenia" },
];

const quickActions = [
  { href: "/city-break-planner", label: "Zaplanuj podróż", meta: "2 dni" },
  { href: "/react", label: "Agent ReAct", meta: "kroki" },
  { href: "/chat", label: "Chat z agentem", meta: "rozmowa" },
  { href: "/think", label: "Tryb myślenia", meta: "analiza" },
  { href: "/generate", label: "Generator grafik", meta: "obrazy" },
  { href: "/fewshot", label: "Słownik AI", meta: "pojęcia" },
];

type AgentMetrics = {
  conversations: number;
  documentChunks: number;
  documents: number;
  lastSync: string;
};

function formatDashboardDate(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AgentPage() {
  const now = useMemo(() => new Date(), []);
  const dashboardDate = formatDashboardDate(now);
  const updateTime = formatTime(now);
  const [metrics, setMetrics] = useState<AgentMetrics>({
    conversations: 0,
    documentChunks: 0,
    documents: 0,
    lastSync: updateTime,
  });

  useEffect(() => {
    let isCancelled = false;

    async function loadMetrics() {
      const [documentsResult, conversationsResult] = await Promise.all([
        supabase.from("documents").select("title, created_at"),
        supabase.from("conversations").select("id", {
          count: "exact",
          head: true,
        }),
      ]);

      if (isCancelled) {
        return;
      }

      const documentRows =
        documentsResult.error || !documentsResult.data ? [] : documentsResult.data;
      const uniqueTitles = new Set(
        documentRows
          .map((document) => document.title?.trim())
          .filter((title): title is string => Boolean(title)),
      );
      const latestDocumentDate = documentRows
        .map((document) => new Date(document.created_at ?? ""))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      setMetrics({
        conversations: conversationsResult.count ?? 0,
        documentChunks: documentRows.length,
        documents: uniqueTitles.size,
        lastSync: latestDocumentDate ? formatTime(latestDocumentDate) : updateTime,
      });
    }

    const timeout = window.setTimeout(() => {
      void loadMetrics();
    }, 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [updateTime]);

  return (
    <main className="agent-dashboard" aria-label="Dashboard agenta">
      <header className="hero-panel">
        <div className="hero-copy">
          <p>Centrum dowodzenia agenta</p>
          <h1>Dzień dobry.</h1>
          <span>Dziś: {dashboardDate}</span>
        </div>

        <div className="hero-metrics" aria-label="Szybki status agenta">
          <div className="metric-head">
            <span aria-hidden="true" />
            <strong>Agent online</strong>
          </div>
          <div className="metric-grid">
            <div>
              <span>Dokumenty</span>
              <b>{metrics.documents}</b>
            </div>
            <div>
              <span>Fragmenty</span>
              <b>{metrics.documentChunks}</b>
            </div>
            <div>
              <span>Rozmowy</span>
              <b>{metrics.conversations}</b>
            </div>
            <div>
              <span>Sync</span>
              <b>{metrics.lastSync}</b>
            </div>
          </div>
        </div>

        <Link className="refresh-control" aria-label="Odśwież dashboard" href="/agent">
          ↻
        </Link>
      </header>

      <section className="summary-row" aria-label="Status agenta">
        <div>
          <span>Model</span>
          <strong>Gemini Flash Lite</strong>
        </div>
        <div>
          <span>Baza wiedzy</span>
          <strong>RAG gotowy</strong>
        </div>
        <div>
          <span>Ostatnia aktywność</span>
          <strong>{updateTime}</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="info-card weather-card">
          <div className="card-title">
            <div>
              <span className="card-kicker">Pogoda</span>
              <h2>Warszawa</h2>
            </div>
            <span>Aktualizacja {updateTime}</span>
          </div>
          <div className="weather-main">
            <span className="weather-glyph" aria-hidden="true" />
            <b>27.6°C</b>
          </div>
          <p>pochmurno</p>
          <div className="metric-list">
            <span>Wiatr 10.1 km/h</span>
            <span>Wilgotność 45%</span>
          </div>
        </article>

        <article className="info-card rates-card">
          <div className="card-title">
            <div>
              <span className="card-kicker">Finanse</span>
              <h2>Kursy walut</h2>
            </div>
            <span>Aktualizacja {updateTime}</span>
          </div>
          <div className="rate-list">
            {exchangeRates.map((rate) => (
              <div className="rate-row" key={rate.code}>
                <b>{rate.code}</b>
                <span>{rate.value}</span>
                <em>↓ {rate.delta}</em>
              </div>
            ))}
          </div>
          <p>Kurs z: 2026-07-16 (NBP)</p>
        </article>

        <article className="info-card holidays-card">
          <div className="card-title">
            <div>
              <span className="card-kicker">Kalendarz</span>
              <h2>Nadchodzące święta</h2>
            </div>
            <span>Aktualizacja {updateTime}</span>
          </div>
          <div className="holiday-list">
            {holidays.map((holiday) => (
              <div className="holiday-row" key={`${holiday.date}-${holiday.name}`}>
                <b>{holiday.date}</b>
                <span>{holiday.name}</span>
              </div>
            ))}
          </div>
          <p>Następne za: 30 dni</p>
        </article>

        <article className="info-card actions-card">
          <div className="card-title">
            <div>
              <span className="card-kicker">Start</span>
              <h2>Szybkie akcje</h2>
            </div>
            <Link href="/chat">Otwórz chat</Link>
          </div>
          <div className="action-grid">
            {quickActions.map((action) => (
              <Link href={action.href} key={action.label}>
                <strong>{action.label}</strong>
                <span>{action.meta}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <style jsx>{`
        .agent-dashboard {
          width: min(1080px, calc(100% - 2.5rem));
          margin: 0 auto;
          padding: 1.25rem 0 2.5rem;
        }

        .hero-panel {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.4fr) auto;
          gap: 1.25rem;
          align-items: center;
          min-height: 190px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1.65rem;
          background:
            linear-gradient(145deg, rgba(32, 37, 49, 0.92), rgba(9, 11, 16, 0.96)),
            #10131b;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 28px 70px rgba(0, 0, 0, 0.44);
        }

        .hero-panel::before {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.06), transparent 24%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 62%);
          content: "";
        }

        .hero-copy,
        .hero-visual,
        .refresh-control {
          position: relative;
          z-index: 1;
        }

        .hero-copy p,
        .hero-copy h1,
        .hero-copy span {
          margin: 0;
        }

        .hero-copy p {
          color: #88f0b3;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .hero-copy h1 {
          margin-top: 0.24rem;
          color: #ffffff;
          font-size: clamp(2.6rem, 6vw, 4.9rem);
          font-weight: 800;
          letter-spacing: -0.045em;
          line-height: 0.96;
        }

        .hero-copy span {
          display: block;
          margin-top: 0.9rem;
          color: #bcc4d4;
          font-size: 0.94rem;
        }

        .hero-metrics {
          display: grid;
          gap: 0.8rem;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 8px;
          padding: 0.85rem;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.035)),
            rgba(255, 255, 255, 0.04);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.14),
            0 18px 42px rgba(0, 0, 0, 0.28);
        }

        .metric-head {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #f7f8fb;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .metric-head span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #87f0b2;
          box-shadow: 0 0 22px rgba(135, 240, 178, 0.55);
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .metric-grid div {
          display: grid;
          gap: 0.16rem;
          min-height: 66px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          padding: 0.62rem;
          background: rgba(0, 0, 0, 0.18);
        }

        .metric-grid span {
          color: #9ca6b8;
          font-size: 0.68rem;
          font-weight: 850;
        }

        .metric-grid b {
          color: #ffffff;
          font-size: 1.08rem;
          letter-spacing: -0.025em;
          line-height: 1.1;
        }

        .refresh-control {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          font-size: 1.15rem;
        }

        .summary-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 0.9rem;
        }

        .summary-row div {
          display: grid;
          gap: 0.18rem;
          min-height: 72px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.045);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .summary-row span,
        .card-kicker,
        .card-title > span,
        .card-title a {
          color: #8f98aa;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .summary-row strong {
          color: #f7f8fb;
          font-size: 0.98rem;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
          margin-top: 0.9rem;
        }

        .info-card {
          min-height: 255px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          padding: 1.1rem;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
            #0f1218;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 24px 56px rgba(0, 0, 0, 0.32);
        }

        .weather-card {
          background:
            linear-gradient(145deg, rgba(46, 115, 128, 0.36), rgba(16, 24, 32, 0.9)),
            #101820;
        }

        .rates-card {
          background:
            linear-gradient(145deg, rgba(58, 128, 88, 0.3), rgba(15, 25, 19, 0.92)),
            #101813;
        }

        .holidays-card {
          background:
            linear-gradient(145deg, rgba(130, 95, 46, 0.34), rgba(30, 22, 13, 0.94)),
            #17130d;
        }

        .actions-card {
          background:
            linear-gradient(145deg, rgba(108, 62, 116, 0.34), rgba(25, 16, 30, 0.94)),
            #17101c;
        }

        .card-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.05rem;
        }

        .card-title h2 {
          margin: 0.2rem 0 0;
          color: #ffffff;
          font-size: 1.05rem;
          letter-spacing: -0.015em;
          line-height: 1.2;
        }

        .card-title > span,
        .card-title a {
          white-space: nowrap;
        }

        .weather-main {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          margin: 1.15rem 0 0.7rem;
        }

        .weather-glyph {
          position: relative;
          display: block;
          width: 50px;
          height: 36px;
        }

        .weather-glyph::before {
          position: absolute;
          left: 0;
          top: 9px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f6c65b;
          content: "";
        }

        .weather-glyph::after {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 38px;
          height: 24px;
          border-radius: 8px;
          background: linear-gradient(145deg, #f2f6ff, #9fb4ef);
          box-shadow: -12px 3px 0 -3px #dce6ff;
          content: "";
        }

        .weather-main b {
          color: #ffffff;
          font-size: clamp(2.2rem, 4vw, 3.2rem);
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .info-card p {
          margin: 0.42rem 0 0;
          color: #c6cedd;
          font-size: 0.9rem;
          line-height: 1.35;
        }

        .metric-list,
        .rate-list,
        .holiday-list,
        .action-grid {
          display: grid;
          gap: 0.6rem;
        }

        .metric-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 1rem;
        }

        .metric-list span,
        .rate-row,
        .holiday-row,
        .action-grid a {
          min-height: 44px;
          border: 1px solid rgba(255, 255, 255, 0.075);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.18);
        }

        .metric-list span {
          display: grid;
          place-items: center start;
          padding: 0.65rem 0.75rem;
          color: #edf2fb;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .rate-row {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          align-items: center;
          gap: 0.65rem;
          padding: 0.58rem 0.7rem;
        }

        .rate-row b,
        .holiday-row b {
          color: #ffffff;
          font-size: 0.84rem;
        }

        .rate-row span,
        .holiday-row span {
          color: #eef2f8;
          font-size: 0.86rem;
          line-height: 1.35;
        }

        .rate-row em {
          border: 1px solid rgba(255, 138, 148, 0.18);
          border-radius: 8px;
          padding: 0.25rem 0.5rem;
          background: rgba(248, 113, 113, 0.12);
          color: #ffa2aa;
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 900;
        }

        .holiday-row {
          display: grid;
          grid-template-columns: 72px 1fr;
          align-items: center;
          gap: 0.65rem;
          padding: 0.62rem 0.75rem;
        }

        .action-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .action-grid a {
          display: grid;
          align-content: center;
          gap: 0.12rem;
          padding: 0.75rem;
        }

        .action-grid a:hover {
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.07);
        }

        .action-grid strong {
          color: #ffffff;
          font-size: 0.87rem;
          line-height: 1.25;
        }

        .action-grid span {
          color: #9fa8bb;
          font-size: 0.72rem;
          font-weight: 800;
        }

        @media (max-width: 920px) {
          .hero-panel {
            grid-template-columns: 1fr;
          }

          .hero-metrics {
            justify-items: start;
          }
        }

        @media (max-width: 720px) {
          .agent-dashboard {
            width: min(100% - 1rem, 1080px);
          }

          .dashboard-grid,
          .summary-row,
          .action-grid,
          .metric-list {
            grid-template-columns: 1fr;
          }

          .card-title {
            flex-direction: column;
          }

          .card-title > span,
          .card-title a {
            white-space: normal;
          }
        }
      `}</style>
    </main>
  );
}
