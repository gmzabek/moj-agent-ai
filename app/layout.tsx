import type { Metadata } from "next";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LEO — Twój osobisty asystent AI",
    template: "%s | LEO",
  },
  description:
    "LEO zna dokumenty Twojej firmy, pamięta rozmowy i pomaga zamieniać wiedzę w konkretne działania.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
