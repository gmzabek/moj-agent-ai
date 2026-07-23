import type { Metadata } from "next";
import { AppSidebar } from "./components/AppSidebar";
import { GeminiFallbackBanner } from "./components/GeminiFallbackBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent AI",
  description: "Agent AI z narzędziami i funkcjami podróżnymi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <div className="app-frame">
          <AppSidebar />
          <div className="app-main">
            <GeminiFallbackBanner />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
