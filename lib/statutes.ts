// Accurate FCRA / FDCPA references. Used to label strategies in the UI and to
// ground letter generation so citations are never invented. `text` holds a
// concise, accurate quotation of the operative statutory language (public law),
// so letters can state the actual obligation — not just the code — for weight.
export const STATUTES = {
  fcra_607b: {
    short: "FCRA §607(b)",
    usc: "15 U.S.C. §1681e(b)",
    desc: "Consumer reporting agencies must follow reasonable procedures to assure maximum possible accuracy.",
    text: "“Whenever a consumer reporting agency prepares a consumer report it shall follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual about whom the report relates.”",
  },
  fcra_609: {
    short: "FCRA §609",
    usc: "15 U.S.C. §1681g",
    desc: "Disclosure of the contents of a consumer's file. NOTE: §609 is a disclosure right, NOT a dispute right.",
    text: "“Every consumer reporting agency shall, upon request … clearly and accurately disclose to the consumer … [a]ll information in the consumer's file at the time of the request.”",
  },
  fcra_611: {
    short: "FCRA §611",
    usc: "15 U.S.C. §1681i",
    desc: "Right to a reasonable reinvestigation of disputed information; deletion/modification if it cannot be verified.",
    text: "“[I]f the completeness or accuracy of any item of information … is disputed by the consumer … the agency shall, free of charge, conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate … before the end of the 30-day period … [and] shall … delete that item of information from the file … or modify that item of information, as appropriate … if [it] is found to be inaccurate or incomplete or cannot be verified.”",
  },
  fcra_605: {
    short: "FCRA §605",
    usc: "15 U.S.C. §1681c",
    desc: "Obsolete information — most adverse items may not be reported after 7 years (10 for some bankruptcies).",
    text: "“[N]o consumer reporting agency may make any consumer report containing … [a]ccounts placed for collection or charged to profit and loss which antedate the report by more than seven years.”",
  },
  fcra_623: {
    short: "FCRA §623",
    usc: "15 U.S.C. §1681s-2(b)",
    desc: "Duties of furnishers of information, including investigation of direct disputes.",
    text: "“After receiving notice … of a dispute … the [furnisher] shall — (i) conduct an investigation with respect to the disputed information; (ii) review all relevant information provided by the consumer reporting agency …; (iii) report the results of the investigation …; and … (iv) if the information is found to be inaccurate or incomplete or cannot be verified … modify … delete … or permanently block the reporting of that item.”",
  },
  fdcpa_809: {
    short: "FDCPA §809(b)",
    usc: "15 U.S.C. §1692g(b)",
    desc: "Debt validation — a debt collector must cease collection until the debt is validated upon timely request.",
    text: "“If the consumer notifies the debt collector in writing within the thirty-day period … that the debt, or any portion thereof, is disputed … the debt collector shall cease collection of the debt … until the debt collector obtains verification of the debt … and a copy of such verification … is mailed to the consumer by the debt collector.”",
  },
  fdcpa_805c: {
    short: "FDCPA §805(c)",
    usc: "15 U.S.C. §1692c(c)",
    desc: "A consumer may notify a collector to cease further communication.",
    text: "“If a consumer notifies a debt collector in writing that the consumer … wishes the debt collector to cease further communication with the consumer, the debt collector shall not communicate further with the consumer” (subject to limited statutory exceptions).",
  },
} as const;

export type StatuteKey = keyof typeof STATUTES;
