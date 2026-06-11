import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0a0c10", 900: "#0e1117", 800: "#151a22", 700: "#1d242f", 600: "#2a3340" },
        brand: { 50: "#eefbf4", 300: "#5fe3a1", 400: "#2bd07f", 500: "#13b86a", 600: "#0d9456", 700: "#0b7344" },
        gold: { 400: "#f2c14e", 500: "#e3a92e" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
        glow: "0 0 0 1px rgba(43,208,127,0.25), 0 8px 30px rgba(43,208,127,0.12)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
