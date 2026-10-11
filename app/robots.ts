import type { MetadataRoute } from "next";

/**
 * robots.txt généré par Next.js. Le tableau de bord, l'administration, les API et les parcours
 * de finalisation de compte ne sont pas destinés aux moteurs de recherche.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/api/", "/auth/", "/completer-profil"],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
