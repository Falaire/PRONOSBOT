import type { MetadataRoute } from "next";

/**
 * Plan du site pour les moteurs de recherche, généré par Next.js sur /sitemap.xml.
 * Seules les pages publiques y figurent : le tableau de bord, l'administration et les parcours
 * de connexion ne doivent pas être indexés (voir app/robots.ts).
 */
const PUBLIC_PAGES: { path: string; changeFrequency: "daily" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/inscription", changeFrequency: "monthly", priority: 0.7 },
  { path: "/connexion", changeFrequency: "monthly", priority: 0.4 },
  { path: "/legal/cgu", changeFrequency: "monthly", priority: 0.2 },
  { path: "/legal/confidentialite", changeFrequency: "monthly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, base).toString(),
    changeFrequency,
    priority,
  }));
}
