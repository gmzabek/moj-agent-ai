"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      className={`theme-toggle${compact ? " compact" : ""}`}
      onClick={toggleTheme}
      title={isDark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      type="button"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      {!compact && <strong>{isDark ? "Jasny" : "Ciemny"}</strong>}
    </button>
  );
}
