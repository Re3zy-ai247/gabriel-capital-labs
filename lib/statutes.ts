// Accurate FCRA / FDCPA references. These are used both to label strategies in the
// UI and to ground the LLM letter generation so citations are never invented.
export const STATUTES = {
  fcra_607b: {
    short: "FCRA §607(b)",
    usc: "15 U.S.C. §1681e(b)",
    desc: "Consumer reporting agencies must follow reasonable procedures to assure maximum possible accuracy.",
  },
  fcra_609: {
    short: "FCRA §609",
    usc: "15 U.S.C. §1681g",
    desc: "Disclosure of the contents of a consumer's file. NOTE: §609 is a disclosure right, NOT a dispute right.",
  },
  fcra_611: {
    short: "FCRA §611",
    usc: "15 U.S.C. §1681i",
    desc: "Right to a reasonable reinvestigation of disputed information; deletion/modification if it cannot be verified.",
  },
  fcra_605: {
    short: "FCRA §605",
    usc: "15 U.S.C. §1681c",
    desc: "Obsolete information — most adverse items may not be reported after 7 years (10 for some bankruptcies).",
  },
  fcra_623: {
    short: "FCRA §623",
    usc: "15 U.S.C. §1681s-2",
    desc: "Duties of furnishers of information, including investigation of direct disputes.",
  },
  fdcpa_809: {
    short: "FDCPA §809(b)",
    usc: "15 U.S.C. §1692g",
    desc: "Debt validation — a debt collector must cease collection until the debt is validated upon timely request.",
  },
  fdcpa_805c: {
    short: "FDCPA §805(c)",
    usc: "15 U.S.C. §1692c(c)",
    desc: "A consumer may notify a collector to cease further communication.",
  },
} as const;

export type StatuteKey = keyof typeof STATUTES;
