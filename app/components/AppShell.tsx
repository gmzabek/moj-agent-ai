"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";
import { GeminiFallbackBanner } from "./GeminiFallbackBanner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return children;
  }

  return (
    <div className="app-frame">
      <AppSidebar />
      <div className="app-main">
        <GeminiFallbackBanner />
        {children}
      </div>
    </div>
  );
}
