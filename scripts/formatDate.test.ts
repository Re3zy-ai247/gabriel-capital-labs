// Standalone assertion test (run: `npx tsx scripts/formatDate.test.ts`).
// Guards the FCRA §605 date display: formatDate must never shift the calendar
// day, regardless of the host timezone. We force TZ=America/Los_Angeles (UTC-7/8)
// — the case that previously rendered dates one day early.
import { formatDate } from "@/lib/utils";

let failures = 0;
function expect(actual: string, want: string, label: string) {
  const ok = actual === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got "${actual}"${ok ? "" : ` — want "${want}"`}`);
}

// Date-only string (the DOFD / dateReported shape stored in bureauData JSON).
expect(formatDate("2021-03-15"), "Mar 15, 2021", "date-only string keeps the day");
expect(formatDate("2020-01-01"), "Jan 1, 2020", "new-year boundary");
expect(formatDate("2019-12-31"), "Dec 31, 2019", "year-end boundary");

// Date object stored as UTC midnight (the Prisma DateTime shape).
expect(formatDate(new Date("2021-03-15T00:00:00.000Z")), "Mar 15, 2021", "UTC-midnight Date keeps the day");

// Full ISO datetime renders on its UTC calendar day.
expect(formatDate("2021-03-15T14:30:00.000Z"), "Mar 15, 2021", "ISO datetime → UTC day");

// Nullish guard.
expect(formatDate(null), "—", "null → em dash");
expect(formatDate(undefined), "—", "undefined → em dash");

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll formatDate assertions passed.");
