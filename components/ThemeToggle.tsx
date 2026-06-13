"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Toggles between dark (default) and light by adding/removing the `light` class
// on <html>, persisted to localStorage. The no-flash script in layout.tsx applies
// the saved choice before first paint.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700 ${className}`}
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
