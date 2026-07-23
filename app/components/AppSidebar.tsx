"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sidebarItems = [
  { href: "/agent", icon: "🏠", label: "Dashboard" },
  { href: "/city-break-planner", icon: "✈️", label: "Podróże" },
  { href: "/react", icon: "🔄", label: "ReAct" },
  { href: "/chat", icon: "💬", label: "Chat" },
  { href: "/history", icon: "📜", label: "Historia" },
  { href: "/think", icon: "🧠", label: "Myślenie" },
  { href: "/fewshot", icon: "📚", label: "Słownik AI" },
  { href: "/upload", icon: "📚", label: "Baza wiedzy" },
  { href: "/knowledge", icon: "📎", label: "Źródła RAG" },
  { href: "/format", icon: "📐", label: "Formatowanie" },
  { href: "/search", icon: "🌐", label: "Szukaj" },
  { href: "/generate", icon: "🎨", label: "Grafiki" },
  { href: "/vision", icon: "👁️", label: "Vision" },
  { href: "/extract", icon: "📊", label: "Analizator" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/agent" && pathname === "/") {
    return true;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar" aria-label="Nawigacja agenta">
      <Link className="app-brand" href="/agent">
        <span aria-hidden="true">⚡</span>
        <strong>
          Agent AI
          <small>Centrum dowodzenia</small>
        </strong>
      </Link>

      <nav className="app-sidebar-nav">
        {sidebarItems.map((item) => (
          <Link
            className={isActivePath(pathname, item.href) ? "active" : ""}
            href={item.href}
            key={`${item.href}-${item.label}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
