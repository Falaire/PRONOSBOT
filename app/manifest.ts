import type { MetadataRoute } from "next";
import { APP_NAME, APP_NAME_FULL } from "@/lib/brand";

/**
 * Manifeste Web App (PWA) — généré par Next.js sur /manifest.webmanifest.
 * Sans ce fichier (absent jusqu'ici), Chrome Android ne propose que "Créer un raccourci"
 * (un simple signet plein écran) au lieu de la vraie option "Installer l'application"
 * (icône dédiée, écran de démarrage, barre d'adresse masquée). Avec ce manifeste + les icônes
 * ci-dessous + le service worker minimal (voir public/sw.js et PwaRegister.tsx), l'installation
 * complète devient possible.
 * Honnêteté : ça reste une PWA (site web installable), pas une vraie app native Play
 * Store/App Store — mais une fois installée, elle s'ouvre en plein écran comme une app normale.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME_FULL,
    short_name: APP_NAME,
    description:
      "Pronostics football par intelligence artificielle, adaptés à l'Afrique de l'Ouest et Centrale. Paiement Mobile Money.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#05070c",
    theme_color: "#05070c",
    orientation: "portrait-primary",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
