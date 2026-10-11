import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WhatsAppBubble } from "@/components/WhatsAppBubble";
import { PwaRegister } from "@/components/PwaRegister";
import { APP_NAME, APP_NAME_FULL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${APP_NAME_FULL} — Pronostics football IA en FCFA`,
  description:
    "Pronostics football par intelligence artificielle (Elo + Poisson), adaptés à l'Afrique de l'Ouest et Centrale. Paiement Mobile Money, sans carte bancaire. 18+, service d'analyse statistique.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: APP_NAME_FULL,
    title: `${APP_NAME_FULL} — Pronostics football IA en FCFA`,
    description:
      "Pronostics football par intelligence artificielle (Elo + Poisson), adaptés à l'Afrique de l'Ouest et Centrale. 18+, service d'analyse statistique.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: APP_NAME_FULL }],
  },
  twitter: {
    card: "summary",
    title: `${APP_NAME_FULL} — Pronostics football IA`,
    description: "Pronostics football par intelligence artificielle, paiement Mobile Money.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen flex flex-col font-sans">
        {children}
        <WhatsAppBubble />
        <PwaRegister />
      </body>
    </html>
  );
}
