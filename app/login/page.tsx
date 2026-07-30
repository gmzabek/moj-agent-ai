"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AuthMode = "sign-in" | "sign-up";

function getNextPath() {
  const nextPath = new URLSearchParams(window.location.search).get("next");
  return nextPath?.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/agent";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (!data.session) {
          setMessage(
            "Konto zostało utworzone. Potwierdź adres e-mail, a potem się zaloguj.",
          );
          setMode("sign-in");
          return;
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (signInError) {
          throw signInError;
        }
      }

      router.replace(getNextPath());
      router.refresh();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Nie udało się zalogować.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span aria-hidden="true">AI</span>
          <div>
            <strong>Agent AI</strong>
            <small>Prywatna przestrzeń robocza</small>
          </div>
        </div>

        <div className="login-heading">
          <p>Bezpieczny dostęp</p>
          <h1 id="login-title">
            {mode === "sign-in" ? "Zaloguj się" : "Utwórz konto"}
          </h1>
        </div>

        <div className="auth-mode" role="tablist" aria-label="Tryb logowania">
          <button
            aria-selected={mode === "sign-in"}
            className={mode === "sign-in" ? "active" : ""}
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setMessage(null);
            }}
            role="tab"
            type="button"
          >
            Logowanie
          </button>
          <button
            aria-selected={mode === "sign-up"}
            className={mode === "sign-up" ? "active" : ""}
            onClick={() => {
              setMode("sign-up");
              setError(null);
              setMessage(null);
            }}
            role="tab"
            type="button"
          >
            Rejestracja
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            E-mail
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ty@firma.pl"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Hasło
            <input
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 znaków"
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="auth-message error">{error}</p> : null}
          {message ? <p className="auth-message success">{message}</p> : null}

          <button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? "Proszę czekać..."
              : mode === "sign-in"
                ? "Zaloguj się"
                : "Zarejestruj się"}
          </button>
        </form>
      </section>
    </main>
  );
}
