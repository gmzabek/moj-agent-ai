import Image from "next/image";
import Link from "next/link";
import styles from "./LandingPage.module.css";
import { ThemeToggle } from "./ThemeToggle";

const features = [
  {
    icon: "🧠",
    title: "Pamięta Twoje rozmowy",
    description: "Wracaj do wcześniejszych wątków i kontynuuj pracę bez powtarzania kontekstu.",
  },
  {
    icon: "📚",
    title: "Zna dokumenty Twojej firmy",
    description: "Odpowiada na podstawie Twojej bazy wiedzy i wskazuje właściwe informacje.",
  },
  {
    icon: "🔐",
    title: "Prywatne dane per user",
    description: "Każdy użytkownik pracuje we własnej, chronionej przestrzeni danych.",
  },
  {
    icon: "⚡",
    title: "Pracuje 24/7",
    description: "Automatyczne briefingi i zadania cykliczne działają także wtedy, gdy odpoczywasz.",
  },
];

export function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />

      <nav className={styles.nav} aria-label="Nawigacja strony głównej">
        <Link className={styles.brand} href="/" aria-label="LEO — strona główna">
          <Image
            alt=""
            className={styles.brandLogo}
            height={38}
            priority
            src="/icon.png"
            width={38}
          />
          LEO
        </Link>
        <div className={styles.navActions}>
          <ThemeToggle />
          <Link className={styles.navCta} href="/login?next=%2F">
            Zaloguj się
          </Link>
        </div>
      </nav>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" /> Agent gotowy do pracy
          </p>
          <h1 id="landing-title">
            Wiedza Twojej firmy.
            <strong>Zawsze pod ręką.</strong>
          </h1>
          <p className={styles.lead}>
            LEO to osobisty asystent, który zna Twoje dokumenty, pamięta rozmowy
            i pomaga zamieniać informacje w konkretne działania.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href="/login?next=%2F">
              <span>🚀</span> Zacznij za darmo
            </Link>
            <a className={styles.secondaryCta} href="#demo">
              Zobacz, jak działa <span>↓</span>
            </a>
          </div>
          <p className={styles.reassurance}>Bez karty kredytowej · Start w 30 sekund</p>
        </div>

        <div className={styles.heroVisual} aria-label="Podgląd rozmowy z LEO">
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.appWindow}>
            <div className={styles.windowTop}>
              <div className={styles.windowDots} aria-hidden="true"><span /><span /><span /></div>
              <p><i /> LEO online</p>
              <span>•••</span>
            </div>
            <div className={styles.chatArea}>
              <div className={`${styles.message} ${styles.userMessage}`}>
                <small>Ty</small>
                <p>Jak wygląda cennik planu Business?</p>
              </div>
              <div className={`${styles.message} ${styles.aiMessage}`}>
                <small>
                  <Image
                    alt=""
                    className={styles.messageLogo}
                    height={16}
                    src="/icon.png"
                    width={16}
                  />
                  LEO
                </small>
                <p>
                  Plan Business kosztuje <strong>299 zł miesięcznie</strong> i obejmuje
                  do 10 użytkowników, 50 GB bazy wiedzy oraz priorytetowe wsparcie.
                </p>
                <span className={styles.source}>📎 Źródło: Cennik_2026.pdf · strona 2</span>
              </div>
              <div className={styles.typing}><span /><span /><span /></div>
            </div>
            <div className={styles.composer}>
              <span>Zapytaj o dokumenty Twojej firmy…</span>
              <b>↑</b>
            </div>
          </div>
          <div className={`${styles.floatingBadge} ${styles.badgeTop}`}>
            <span>✓</span><div><b>Odpowiedź z bazy wiedzy</b><small>Sprawdzono źródło</small></div>
          </div>
          <div className={`${styles.floatingBadge} ${styles.badgeBottom}`}>
            <span>🔒</span><div><b>Twoje dane są prywatne</b><small>Izolacja per użytkownik</small></div>
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-title">
        <div className={styles.sectionHeading}>
          <p>JEDEN ASYSTENT. PEŁNY KONTEKST.</p>
          <h2 id="features-title">Wszystko, czego potrzebujesz do mądrzejszej pracy</h2>
        </div>
        <div className={styles.featureGrid}>
          {features.map((feature, index) => (
            <article className={styles.featureCard} key={feature.title} style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}>
              <span className={styles.featureIcon}>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.demo} id="demo" aria-labelledby="demo-title">
        <div className={styles.demoCopy}>
          <p className={styles.eyebrow}>OD PYTANIA DO PEWNEJ ODPOWIEDZI</p>
          <h2 id="demo-title">Nie szukaj w folderach. Po prostu zapytaj.</h2>
          <p>
            LEO przeszukuje dokumenty, wyciąga właściwy fragment i pokazuje źródło.
            Ty podejmujesz decyzję — szybciej i z pełnym kontekstem.
          </p>
          <ul>
            <li><span>✓</span> Odpowiedzi oparte na firmowych źródłach</li>
            <li><span>✓</span> Czytelne odnośniki do dokumentów</li>
            <li><span>✓</span> Historia dostępna przy kolejnym logowaniu</li>
          </ul>
        </div>
        <div className={styles.demoPrompt}>
          <span className={styles.promptLabel}>Przykładowe pytanie</span>
          <blockquote>„Zapytaj o cennik — agent odpowie z Twoich dokumentów.”</blockquote>
          <div><span>PDF</span><p><b>Cennik_2026.pdf</b><small>Gotowy do przeszukania</small></p><i>✓</i></div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <Image
            alt="Logo LEO"
            className={styles.ctaLogo}
            height={72}
            src="/icon.png"
            width={72}
          />
          <p>TWÓJ AGENT CZEKA</p>
          <h2>Gotowy? Zacznij w 30 sekund.</h2>
          <span>Załóż bezpłatne konto i porozmawiaj z LEO.</span>
          <Link className={styles.primaryCta} href="/login?next=%2F">
            Stwórz konto <b>→</b>
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/">
          <Image
            alt=""
            className={styles.brandLogo}
            height={38}
            src="/icon.png"
            width={38}
          />
          LEO
        </Link>
        <p>Twój osobisty asystent AI z bazą wiedzy firmy.</p>
        <span>© 2026 LEO</span>
      </footer>
    </main>
  );
}
