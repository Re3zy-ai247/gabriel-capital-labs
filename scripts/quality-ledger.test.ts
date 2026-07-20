// Run: npx tsx scripts/quality-ledger.test.ts
//
// Keeps .ai/quality-ledger.json honest, so it stays a source of truth rather than
// drifting into stale decoration. The ledger is the machine-readable state of every
// verified quality defect (Track C-5); this guard enforces its invariants.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const root = join(__dirname, "..");
const ledger = JSON.parse(readFileSync(join(root, ".ai/quality-ledger.json"), "utf8"));
const defects: any[] = ledger.defects ?? [];

check("ledger has a defects array", Array.isArray(defects) && defects.length > 0);

// Fingerprints are the dedupe key — they MUST be unique, or the same defect gets
// counted twice across runs (the exact thing Track C-5 exists to prevent).
const fps = defects.map((d) => d.fingerprint);
check("every fingerprint is unique", new Set(fps).size === fps.length);
check("every defect has a fingerprint of the form domain/name",
  defects.every((d) => typeof d.fingerprint === "string" && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(d.fingerprint)));

const SEV = new Set(["critical", "high", "medium", "low"]);
const STATUS = new Set(["open", "fixed", "owner-action", "blocked"]);
check("every severity is valid", defects.every((d) => SEV.has(d.severity)));
check("every status is valid", defects.every((d) => STATUS.has(d.status)));

// A defect marked fixed must name the commit that fixed it, or "fixed" means nothing.
check("every fixed defect names a fix_commit",
  defects.filter((d) => d.status === "fixed").every((d) => !!d.fix_commit));

// A blocked or owner-action defect must say what it is waiting on (in a field or the
// evidence), so it can never sit silently.
check("every non-engineering-closeable defect records why it is open",
  defects.filter((d) => d.status === "blocked" || d.status === "owner-action")
    .every((d) => !!d.evidence && (d.owner === "owner" || d.owner === "counsel" || !!d.blocked_by)));

// Repair-eligibility discipline (Track C-4): a defect in a never-eligible domain
// must never be flagged eligible for autonomous repair.
const BANNED = ["billing/", "auth/", "migration", "compliance/", "observability/"];
check("no defect in a never-eligible domain is marked eligible",
  defects.every((d) => !(d.eligible === true && BANNED.some((b) => d.fingerprint.startsWith(b) || d.fingerprint.includes(b)))));

// The schema block must document the fields and the repair policy, so the file is
// self-describing to whatever reads it next.
check("ledger documents its own schema", !!ledger._schema?.fields && !!ledger._schema?.repair_eligibility);

// recurrence is a number (0 for never re-appeared) — it must exist so a fixed
// defect coming back is a countable event, not a fresh row.
check("every defect carries a numeric recurrence count",
  defects.every((d) => Number.isInteger(d.recurrence)));

console.log(`\nquality-ledger.test.ts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
