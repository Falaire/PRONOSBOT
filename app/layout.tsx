import type { Metadata } from "next";
import "./globals.css";
import { WhatsAppBubble } from "@/components/WhatsAppBubble";

export const metadata: Metadata = {
  title: "KickPredict Togo — Pronostics football IA en FCFA",
  description:
    "Pronostics football par intelligence artificielle (Elo + Poisson), adaptés au Togo et à l'UEMOA. Paiement T-Money / Flooz, sans carte bancaire. 18+, service d'analyse statistique.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen flex flex-col font-sans">
        {children}
        <WhatsAppBubble />
      </body>
    </html>
  );
}
