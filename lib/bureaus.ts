import type { Bureau } from "@prisma/client";

export const BUREAU_LABEL: Record<Bureau, string> = {
  EQUIFAX: "Equifax",
  EXPERIAN: "Experian",
  TRANSUNION: "TransUnion",
};

export const BUREAU_SHORT: Record<Bureau, string> = {
  EQUIFAX: "EQ",
  EXPERIAN: "EX",
  TRANSUNION: "TU",
};

// Mailing addresses for bureau dispute departments (public, well-known).
export const BUREAU_ADDRESS: Record<Bureau, { name: string; lines: string[]; phone: string }> = {
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    lines: ["P.O. Box 740256", "Atlanta, GA 30374-0256"],
    phone: "1-888-378-4329",
  },
  EXPERIAN: {
    name: "Experian",
    lines: ["P.O. Box 4500", "Allen, TX 75013"],
    phone: "1-888-397-3742",
  },
  TRANSUNION: {
    name: "TransUnion LLC Consumer Dispute Center",
    lines: ["P.O. Box 2000", "Chester, PA 19016-2000"],
    phone: "1-800-916-8800",
  },
};
