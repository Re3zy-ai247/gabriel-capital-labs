// Guard for the Kai asset manifest laws (assets/kai/README.md):
// canonical renders are never overwritten, every non-v1 references its parent,
// every entry carries the full metadata schema. Run: npx tsx scripts/kai-manifest.test.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const manifestPath = join(ROOT, "assets/kai/manifest.json");

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) passed++;
  else {
    failed++;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const raw = readFileSync(manifestPath, "utf8");
let manifest: any;
try {
  manifest = JSON.parse(raw);
  check("manifest parses as JSON", true);
} catch (e) {
  check("manifest parses as JSON", false, String(e));
  console.log(`kai-manifest.test.ts: ${passed} passed, ${failed} failed`);
  process.exit(1);
}

const assets: any[] = manifest.assets ?? [];
check("manifest has assets array", Array.isArray(assets) && assets.length > 0);

const REQUIRED = ["id", "version", "date", "prompt", "generator", "lighting", "camera", "expression", "pose", "approvedBy", "canonical", "file", "status"];
const ids = new Set<string>();
const versionKeys = new Set<string>();

for (const a of assets) {
  const label = a?.id ?? "(missing id)";
  for (const f of REQUIRED) {
    check(`${label}: has ${f}`, f in a, `field "${f}" missing`);
  }
  check(`${label}: credits field present (number or null)`, "credits" in a && (a.credits === null || typeof a.credits === "number"));
  check(`${label}: unique id+version`, !versionKeys.has(`${a.id}@${a.version}`), "duplicate id@version");
  versionKeys.add(`${a.id}@${a.version}`);
  ids.add(a.id);

  // Versioning law: v1 has no parent; every later version names its parent.
  if (a.version === "v1") {
    check(`${label}: v1 has null parentVersion`, a.parentVersion === null || a.parentVersion === undefined);
  } else {
    check(`${label}: non-v1 references parentVersion`, typeof a.parentVersion === "string" && a.parentVersion.length > 0);
    if (typeof a.parentVersion === "string") {
      check(`${label}: parentVersion exists in manifest`, versionKeys.has(`${a.id}@${a.parentVersion}`) || assets.some((p) => p.id === a.id && p.version === a.parentVersion));
    }
  }

  // Canonical law: founder-approved, and its file (once present) must exist.
  if (a.canonical === true) {
    check(`${label}: canonical has approvedBy`, typeof a.approvedBy === "string" && a.approvedBy.length > 0);
    if (a.status !== "file-pending-drop") {
      check(`${label}: canonical file exists on disk`, existsSync(join(ROOT, "assets/kai", a.file)), a.file);
    }
  }

  // File status honesty: if status says present, the file must exist.
  if (a.status === "present") {
    check(`${label}: file exists for status=present`, existsSync(join(ROOT, "assets/kai", a.file)), a.file);
  }
}

// Folder tree law: the nine folders exist.
for (const d of ["master", "renders", "expressions", "animations", "marketing", "landing-page", "social", "youtube", "holograms"]) {
  check(`folder exists: assets/kai/${d}`, existsSync(join(ROOT, "assets/kai", d)));
}

console.log(`kai-manifest.test.ts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
