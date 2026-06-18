import type { Config } from "tailwindcss";

// Surface + text palettes are CSS-variable-backed so a single class on <html>
// (.light) flips the whole app between dark (default navy) and light. The accent
// families (brand/ocean/success/gold) are static hex — they read the same on both
// themes. Palette: deep navy surfaces, a blue→teal "vector" primary, and the
// original CreditVector green kept strictly for success/positive states.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Navy surface ramp (was charcoal). 950 = deepest page, 800 = card, 700 = border.
        ink: {
          950: v("ink-950"),
          900: v("ink-900"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
        },
        // Theme-aware slate: bright shades (200/300) are text and flip dark in light
        // mode; dark shades (700–950) are surfaces and flip light. Unchanged mechanism.
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
        // Primary — blue→teal "vector" family. The CTA / active / accent color.
        brand: {
          50: "#ecfeff",
          100: "#d0f6fb",
          200: "#a6ecf5",
          300: "#67dbec",
          400: "#28c2db",
          500: "#0ea5c4",
          600: "#0c83a3",
          700: "#0f6883",
          800: "#13556b",
          900: "#15485b",
          // Fixed near-black navy that reads AA on the bright teal button bg in BOTH themes.
          ink: "#04121b",
        },
        // Secondary deep blue — adds depth to gradients and the navy → blue washes.
        ocean: {
          300: "#60a5fa",
          400: "#3b82f6",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e3a8a",
        },
        // Success = the original CreditVector green. Positive / resolved / upward only.
        success: {
          300: "#5fe3a1",
          400: "#2bd07f",
          500: "#13b86a",
          600: "#0d9456",
          700: "#0b7344",
        },
        gold: { 400: "#f2c14e", 500: "#e3a92e" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Display headlines use the same variable face at heavier weights + tight tracking.
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Navy-tinted depth, not pure black — lighter at rest, deeper on lift.
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 14px 36px -16px rgba(2,8,23,0.65)",
        glow: "0 0 0 1px rgba(14,165,196,0.22), 0 14px 44px -14px rgba(14,165,196,0.38)",
        lift: "0 28px 70px -24px rgba(2,8,23,0.75)",
      },
      borderRadius: { xl2: "1.25rem" },
      maxWidth: { content: "1200px", wide: "1320px" },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
