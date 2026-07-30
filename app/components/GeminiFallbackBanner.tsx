"use client";

import { useEffect, useState } from "react";
import {
  clearGeminiFallbackStatus,
  GEMINI_FALLBACK_EVENT,
  readGeminiFallbackStatus,
  type GeminiFallbackStatus,
} from "./geminiFallbackStatus";

function formatLastAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function GeminiFallbackBanner() {
  const [status, setStatus] = useState<GeminiFallbackStatus | null>(() =>
    readGeminiFallbackStatus(),
  );

  useEffect(() => {
    function handleStatus(event: Event) {
      setStatus((event as CustomEvent<GeminiFallbackStatus>).detail);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === "gemini-fallback-status") {
        setStatus(readGeminiFallbackStatus());
      }
    }

    window.addEventListener(GEMINI_FALLBACK_EVENT, handleStatus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GEMINI_FALLBACK_EVENT, handleStatus);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  if (!status?.active) {
    return null;
  }

  return (
    <aside className="fallback-banner" role="status" aria-live="polite">
      <div>
        <strong>Tryb awaryjny Gemini</strong>
        <span>
          Modele Gemini są teraz niedostępne albo limit API został wyczerpany.
          Zdarzenia: {status.count}
          {status.requestedModel ? ` | Model: ${status.requestedModel}` : ""}
          {status.fallbackModel ? ` | Fallback: ${status.fallbackModel}` : ""}
          {status.lastAt ? ` | Ostatnio: ${formatLastAt(status.lastAt)}` : ""}
        </span>
      </div>
      <button onClick={() => setStatus(clearGeminiFallbackStatus())} type="button">
        Ukryj
      </button>
    </aside>
  );
}
