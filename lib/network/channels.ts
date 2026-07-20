// Operator Network channel registry — a value-object map over the FROZEN community
// category keys. No Prisma model (model Channel is governance-banned and unneeded).
//
// Every channel is "members" today, so the live surface stays exactly the current
// paywall: no channel is "public" (so anonymous/free view is authorized-but-dormant)
// and none is "agency_private" (so the private-audience code paths are inert until
// the persistence + attachment-isolation work ships behind the flag). Unknown keys
// fail closed to "members", never to public or agency_private.
import { CATEGORY_KEYS } from "@/lib/communityShared";
import type { Channel, ChannelVisibility } from "./authz";

const VISIBILITY: Readonly<Record<string, ChannelVisibility>> = {
  "": "members",       // Executive Briefing (root)
  general: "members",
  wins: "members",
  strategy: "members",
  tools: "members",
  questions: "members",
};

export function channelForCategory(category: string): Channel {
  const visibility = VISIBILITY[category] ?? "members"; // unknown => members (fail-closed)
  return { key: category, visibility, ownerAgencyId: null };
}

// The keys the registry knows about — the frozen set plus the root. Used by callers
// to validate a requested channel before authorizing.
export const KNOWN_CHANNEL_KEYS: readonly string[] = ["", ...CATEGORY_KEYS];
