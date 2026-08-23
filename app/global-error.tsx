"use client";

// Root error boundary. `app/error.tsx` sits BELOW the root layout, so it cannot catch a throw
// inside the root layout itself (or in the root template) — that failure is uncatchable without
// this file and renders as a browser-default white screen. Next.js replaces the entire root
// layout with this component, which is why it renders its own <html> and <body>.
//
// Deliberately dependency-free and inline-styled: this is the boundary that runs when the shell
// FAILED, so it must not import anything that could itself throw or be missing — no prisma, no
// next/headers, no brand/server module, no icon package, and no reliance on the Tailwind
// stylesheet having loaded. Copy voice and treatment mirror app/error.tsx; the digest is
// surfaced the same way so an incident can be correlated to a Vercel log line.
//
// A1-12 · copy ADOPTED from the free consumer lane, commit a130d2d ("fix: close bounded consumer
// launch defects"), verbatim — same reasoning as app/error.tsx: the boundary cannot know that
// nothing was lost, and must never read as a statement about the reader's credit.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          textAlign: "center",
          // Fixed dark rather than the theme-aware ink token: the stylesheet that defines the
          // token may be exactly what failed to load.
          background: "#060a14",
          color: "#ffffff",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: "32rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", lineHeight: 1.25, fontWeight: 600 }}>
            Something went wrong on our end
          </h1>
          <p style={{ margin: "0.75rem auto 0", maxWidth: "24rem", color: "#94a3b8", lineHeight: 1.6 }}>
            We hit a technical error. If you were making a change, confirm its status before retrying.
            This message is not a credit decision and does not itself change your credit report.
          </p>
          {error.digest ? (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#475569" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "0.75rem",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                background: "#0ea5c4",
                color: "#04121b",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                display: "inline-block",
                borderRadius: "0.75rem",
                border: "1px solid #475569",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#ffffff",
                textDecoration: "none",
              }}
            >
              Reload CreditVector
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
