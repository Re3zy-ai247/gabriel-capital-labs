// CreditVector Academy (Sprint XXI, Phase 3). A deterministic, progressive learning
// path — NOT a documentation page. Eight levels from "understand your report" through
// "business credit". Every lesson is educational (CROA-safe: it teaches the process
// and the law, it never promises a deletion, a score, or an outcome), and every
// lesson connects to the user's ACTUAL file when the data to do so is present — never
// invented. Pure over the CVI snapshot; no AI, no fabrication. Mission Control reads
// `nextLesson` to point the user at the most relevant next step in their learning.
import type { IntelSnapshot } from "@/lib/intelligence";

export interface AcademyLesson {
  level: number;               // 1–8, the progression order
  id: string;
  title: string;               // customer language (no internal system names)
  summary: string;             // one line: what this level teaches
  keyPoints: string[];         // the teaching points — educational, never a promise
  connection: string | null;   // ties the lesson to the user's real file, or null
  relevant: boolean;           // does this lesson map to something on the user's file now?
  cta: { text: string; href: string } | null; // where to act on it in the product
}

export interface Academy {
  lessons: AcademyLesson[];
  nextLesson: AcademyLesson | null; // the recommended next lesson given the file state
  hasReport: boolean;
  note: string;
}

// The curriculum. Each lesson's `connect` maps the snapshot to an honest, file-
// specific line (or null when the file doesn't contain the data to say anything).
interface LessonDef {
  level: number; id: string; title: string; summary: string; keyPoints: string[];
  cta: { text: string; href: string } | null;
  connect: (s: IntelSnapshot) => { line: string | null; relevant: boolean };
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const CURRICULUM: LessonDef[] = [
  {
    level: 1, id: "report", title: "Understanding your credit report",
    summary: "What's on a report, who reports it, and how to read each account.",
    keyPoints: [
      "Three nationwide bureaus — Equifax, Experian, TransUnion — each hold a separate file, and they don't always match.",
      "Every account (a \"tradeline\") shows a status, balance, and dates; the date of first delinquency drives how long a negative can stay.",
      "You have the right to see everything in your file — that's a disclosure right under FCRA §609, separate from disputing it.",
      "Accuracy is the standard: under FCRA §607(b) a bureau must follow reasonable procedures to assure maximum possible accuracy.",
    ],
    cta: { text: "Review your tradelines", href: "/tradelines" },
    connect: (s) => s.hasReport
      ? { line: `Your file shows ${plural(s.totalAccounts, "account")}, including ${plural(s.negatives, "active negative")}.`, relevant: true }
      : { line: null, relevant: true },
  },
  {
    level: 2, id: "collections", title: "Collections",
    summary: "How collection accounts work and what a debt buyer must be able to prove.",
    keyPoints: [
      "A collection is a debt a third party is trying to collect — often bought for pennies, sometimes with thin records.",
      "You can require a collector to validate the debt under FDCPA §809(b): the amount, the original creditor, and their authority to collect.",
      "The chain of title (who sold the debt to whom) is frequently the weakest link a debt buyer can document.",
      "Requesting validation is a process right — it compels documentation; it never guarantees removal.",
    ],
    cta: { text: "See your collections", href: "/tradelines" },
    connect: (s) => s.collections > 0
      ? { line: `You have ${plural(s.collections, "collection")} on file.`, relevant: true }
      : { line: "No collection accounts are on your file right now.", relevant: false },
  },
  {
    level: 3, id: "late_payments", title: "Late payments",
    summary: "How late-payment history is weighed and what a goodwill request can and can't do.",
    keyPoints: [
      "Payment history is the single largest scoring factor; recent lates weigh more than old ones.",
      "An accurate late payment can't be disputed away — but a late reported in error can be corrected.",
      "A goodwill request asks a creditor to remove an accurate late as a courtesy; it is not a legal demand and is never guaranteed.",
      "On-time payments going forward are what rebuild the pattern over time.",
    ],
    cta: null,
    connect: (s) => ({ line: "Month-by-month late history isn't itemized in a parsed dispute report, so this stays educational until that data is available.", relevant: s.negatives > 0 }),
  },
  {
    level: 4, id: "charge_offs", title: "Charge-offs",
    summary: "What a charge-off means, why the balance still matters, and how it ages.",
    keyPoints: [
      "A charge-off is an accounting move by the original creditor — the debt can still be owed, sold, or collected.",
      "The same debt can appear twice (original creditor + collector); a single debt reported as two open balances is an accuracy concern.",
      "The date of first delinquency — not the charge-off date — controls the ~7-year reporting window under FCRA §605.",
      "Disputing targets what can't be verified as accurate and complete; it doesn't erase an accurate, in-window debt.",
    ],
    cta: { text: "Work charge-offs in a campaign", href: "/campaigns" },
    connect: (s) => s.chargeOffs > 0
      ? { line: `You have ${plural(s.chargeOffs, "charge-off")} on file.`, relevant: true }
      : { line: "No charge-offs are on your file right now.", relevant: false },
  },
  {
    level: 5, id: "dispute_strategy", title: "Dispute strategy",
    summary: "Why focused, evidence-led campaigns beat scattershot disputes.",
    keyPoints: [
      "A dispute asks for a reasonable reinvestigation under FCRA §611 — lead with the specific factual concern, not a demand.",
      "Focused campaigns (a few well-documented items) are harder to dismiss as frivolous than a mass mailing.",
      "Match the letter to the recipient: bureaus reinvestigate, furnishers investigate their own records, collectors validate.",
      "Every item you send starts a ~30-day clock; CreditVector tracks each one for you.",
    ],
    cta: { text: "Open your campaigns", href: "/campaigns" },
    connect: (s) => s.disputable > 0
      ? { line: `${plural(s.disputable, "item")} on your file ${s.disputable === 1 ? "is" : "are"} currently disputable.`, relevant: true }
      : { line: "Nothing is queued as disputable right now.", relevant: s.negatives > 0 },
  },
  {
    level: 6, id: "mov", title: "Method of Verification",
    summary: "What to do when a bureau says \"verified\" without showing its work.",
    keyPoints: [
      "If a bureau returns \"verified\" it should be able to disclose HOW — the business contacted and the procedure used (FCRA §611(a)(7)).",
      "A reinvestigation that just re-confirms the furnisher's own data may not be reasonable (the Cushman / Hinkle standard).",
      "A Round 2 letter presses for the method of verification and the specific documentation relied upon.",
      "This is where many stalled disputes get unstuck — by challenging the adequacy of the process, not re-arguing the fact.",
    ],
    cta: { text: "Review your responses", href: "/letters" },
    connect: (s) => s.round2Ready > 0
      ? { line: `${plural(s.round2Ready, "response")} on your file ${s.round2Ready === 1 ? "is" : "are"} ready for a method-of-verification follow-up.`, relevant: true }
      : s.openInvestigations > 0
        ? { line: `You have ${plural(s.openInvestigations, "open investigation")} — this lesson explains what a strong response looks like.`, relevant: true }
        : { line: "No investigations are open yet — worth reading before you mail.", relevant: false },
  },
  {
    level: 7, id: "cfpb", title: "Escalation & the CFPB",
    summary: "When a window lapses, and how the CFPB and state AG fit in.",
    keyPoints: [
      "A bureau generally must complete a reinvestigation within ~30 days; a non-answer past that window is grounds to escalate.",
      "The Consumer Financial Protection Bureau takes complaints and routes them to the company for a tracked response — it's a free consumer channel.",
      "Your state Attorney General is a second escalation path for unresolved reporting problems.",
      "Escalation is a process lever, not a guaranteed outcome — but documented persistence is how many cases resolve.",
    ],
    cta: { text: "Check your deadlines", href: "/letters" },
    connect: (s) => s.overdueWindows > 0
      ? { line: `${plural(s.overdueWindows, "response window")} on your file ${s.overdueWindows === 1 ? "has" : "have"} already passed — escalation is available.`, relevant: true }
      : { line: "No windows are overdue right now — Kai watches these clocks for you.", relevant: false },
  },
  {
    level: 8, id: "business", title: "Business credit",
    summary: "How business credit differs from personal — a future CreditVector module.",
    keyPoints: [
      "Business credit is built under an entity (EIN/DUNS), separate from your personal file.",
      "It starts with vendor tradelines that report, and a clean, consistent business profile.",
      "It does not draw on your personal report, and CreditVector infers nothing about it today.",
      "This module is on the roadmap — nothing here is collected or connected externally yet.",
    ],
    cta: null,
    connect: () => ({ line: "Business credit is a future module — this lesson is a preview.", relevant: false }),
  },
];

// The single recommended next lesson — meets the user where they are, in the same
// deterministic spirit as Mission Control's "what to do next". No report → start at
// Level 1; otherwise point at the lesson tied to the user's most pressing stage.
function pickNext(s: IntelSnapshot, lessons: AcademyLesson[]): AcademyLesson | null {
  const byId = (id: string) => lessons.find((l) => l.id === id) ?? null;
  if (!s.hasReport) return byId("report");
  if (s.overdueWindows > 0) return byId("cfpb");
  if (s.round2Ready > 0) return byId("mov");
  if (s.disputable > 0 && s.openInvestigations === 0) return byId("dispute_strategy");
  if (s.openInvestigations > 0) return byId("mov");
  if (s.collections > 0) return byId("collections");
  if (s.chargeOffs > 0) return byId("charge_offs");
  return byId("report");
}

export function buildAcademy(s: IntelSnapshot): Academy {
  const lessons: AcademyLesson[] = CURRICULUM.map((d) => {
    const c = d.connect(s);
    return { level: d.level, id: d.id, title: d.title, summary: d.summary, keyPoints: d.keyPoints, connection: c.line, relevant: c.relevant, cta: d.cta };
  });
  return {
    lessons,
    nextLesson: pickNext(s, lessons),
    hasReport: s.hasReport,
    note: "CreditVector Academy is educational. It explains your rights and the dispute process — it does not provide legal advice or guarantee any outcome.",
  };
}
