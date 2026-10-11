/** @type {import('next').NextConfig} */

/**
 * En-têtes de sécurité sans risque pour l'existant. Volontairement PAS de X-Frame-Options ni de
 * CSP stricte : l'aperçu en direct de la plateforme affiche le site dans un iframe, et une CSP
 * trop stricte casserait les scripts Next.js inline.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Tree-shaking renforcé sur les bibliothèques à grands barrels (icônes, animations).
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/motifs/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
