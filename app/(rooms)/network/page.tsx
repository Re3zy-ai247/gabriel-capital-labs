import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/session";
import { operatorNetworkAccessible } from "@/lib/network/cohort";
import { communityDisplayName } from "@/lib/community";
import { BRIEFING_ROOM, CATEGORIES } from "@/lib/communityShared";
import { NetworkClient, type NetworkChannel } from "./NetworkClient";

export const dynamic = "force-dynamic";

// Operator Network — the live operating floor. Server-authoritative gate: the flag
// being ON is NOT enough; the account must be in the internal cohort, checked here.
// Outside the cohort (or flag OFF) redirects away, so there is no UI-only gate and
// no hidden data path. Identity is currentAccount() — the real signed-in account,
// matching how the message API authorizes (never the opened workspace client).
export default async function NetworkPage() {
  const account = await currentAccount();
  if (!operatorNetworkAccessible(account)) redirect("/dashboard");

  // Every channel is "members" today, so all are shown; the API re-authorizes each
  // request server-side regardless of what the UI offers.
  const channels: NetworkChannel[] = [
    { key: BRIEFING_ROOM.key, label: BRIEFING_ROOM.label },
    ...CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
  ];

  return <NetworkClient channels={channels} me={communityDisplayName(account!)} />;
}
