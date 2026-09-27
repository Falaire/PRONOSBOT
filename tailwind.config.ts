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
          900: "#0b1220",
          800: "#111a2b",
          700: "#182338",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
