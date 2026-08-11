// server: compute review capability once; NO auth here (pages keep their guards —
// auth semantics preserved exactly; admin precedent notwithstanding, adding a group
// auth gate would CHANGE per-page redirect targets, so we don't).
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { RoomsShell } from "@/components/shell/RoomsShell";

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return <RoomsShell reviewInstrumentsAllowed={reviewBuildAllowed()}>{children}</RoomsShell>;
}
