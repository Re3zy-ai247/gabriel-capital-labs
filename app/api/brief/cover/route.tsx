import { ImageResponse } from "next/og";

export const runtime = "edge";

// Stateless, query-param-driven branded image for Brief articles (1200x630). No
// copyright/AI-photo risk. Two modes:
//   • with ?title=…  → headline card, used as the Open Graph / social image only.
//   • without title  → branded masthead (category + tagline), the ON-PAGE cover —
//     omits the title so it never duplicates the heading shown right beside it.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "").slice(0, 160);
  const category = (searchParams.get("category") || "News").slice(0, 40);
  const hasTitle = title.trim().length > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a1224 0%, #0c1830 55%, #0a2a2e 100%)",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#34d399,#22d3ee)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "white", fontSize: 30, fontWeight: 700 }}>CreditVector Brief</span>
            <span style={{ color: "#7dd3fc", fontSize: 18 }}>by Gabriel Capital Labs</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <span
            style={{
              alignSelf: "flex-start",
              color: "#5eead4",
              fontSize: 24,
              fontWeight: 600,
              background: "rgba(45,212,191,0.12)",
              border: "1px solid rgba(45,212,191,0.3)",
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {category}
          </span>
          {hasTitle ? (
            <span style={{ color: "white", fontSize: 56, fontWeight: 800, lineHeight: 1.12, maxWidth: 1010 }}>{title}</span>
          ) : (
            <span style={{ color: "white", fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 1010 }}>Consumer-credit news, explained</span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: 20 }}>Educational news summary · not legal advice</span>
          <span style={{ color: "#cbd5e1", fontSize: 20 }}>creditvector.app/brief</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": "public, max-age=86400, immutable" },
    }
  );
}
