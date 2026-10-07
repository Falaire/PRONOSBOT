import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6fae2",
          200: "#aef3c8",
          300: "#78e6a7",
          400: "#3fd17f",
          500: "#18b862", // vert Togo
          600: "#0f954f",
          700: "#0f7541",
          800: "#0f5c36",
          900: "#0d4b2e",
        },
        accent: {
          400: "#ffd23f",
          500: "#f7b500", // or / jaune Togo
          600: "#d99a00",
        },
        ink: {
          950: "#05070c",
          900: "#0a0f1a",
          800: "#111a2b",
          700: "#182338",
          600: "#22304a",
        },
      },
      fontFamily: {
        // Pile de polices système haut de gamme (celle utilisée en repli par Stripe/Revolut) —
        // aucune dépendance réseau externe (Google Fonts), donc fiable sur tout environnement.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(24,184,98,0.15), 0 8px 30px -8px rgba(24,184,98,0.35)",
        "glow-accent": "0 0 0 1px rgba(247,181,0,0.15), 0 8px 30px -8px rgba(247,181,0,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
