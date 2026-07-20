import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/stripe";

// Sitemap for the PUBLIC surface only. Authenticated routes are deliberately
// excluded: to a crawler they render a "Please sign in" shell, so indexing them
// would put dozens of empty pages under the brand. Kept in lockstep with the
// Disallow list in public/robots.txt.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl().replace(/\/$/, "");
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/login", priority: 0.3, changeFrequency: "yearly" },
    { path: "/register", priority: 0.6, changeFrequency: "yearly" },
    { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  ];
  return routes.map((r) => ({
    url: `${base}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
