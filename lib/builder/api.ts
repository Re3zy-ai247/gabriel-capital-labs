// Builder API — loads the CVI snapshot ONCE and composes both CVI and the Builder
// from it (no duplicated query). On the dashboard we call buildBuilder() directly
// with the already-loaded snapshot + intel.
import { loadSnapshot, assembleIntelligence } from "@/lib/intelligence";
import { buildBuilder } from "./engine";
import type { BuilderOS } from "./types";

export async function builderOS(userId: string): Promise<BuilderOS> {
  const snap = await loadSnapshot(userId);
  return buildBuilder(snap, assembleIntelligence(snap));
}
