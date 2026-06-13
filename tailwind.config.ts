import type { Config } from "tailwindcss";

// Surface + text palettes are CSS-variable-backed so a single class on <html>
// (.light) flips the whole app between dark (default) and light. Dark values
// equal the original hex colors, so dark mode is unchanged.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: v("ink-950"),
          900: v("ink-900"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
        },
        // Override the slate shades the app actually uses so they become
        // theme-aware. Bright shades (200/300) serve as text and flip to dark in
        // light mode; dark shades (700–950) serve as surfaces and flip to light.
        slate: {
          50: v("slate-50"),
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
          700: v("slate-700"),
          800: v("slate-800"),
          900: v("slate-900"),
          950: v("slate-950"),
        },
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
