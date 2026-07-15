// Clock / Version Authority (Sprint 1, primitive #9). The SINGLE source of monotonic
// version + logical time. No plugin mints time (preserves determinism, causality, audit
// integrity). The kernel stamps records bitemporally through here.
import type { ClockSource, Stamp, Version } from "./types";

// Build a bitemporal stamp. `validTime` defaults to transaction time when the fact is
// "true now" (the common case); callers pass an explicit validTime for backdated facts.
export function stamp(clock: ClockSource, validTime?: string): Stamp {
  const txTime = clock.now();
  return { validTime: validTime ?? txTime, txTime, version: clock.nextVersion() };
}

// In-memory reference source — used in tests and as the shape a durable adapter (a DB
// sequence + wall clock) must satisfy in prod. Monotonic by construction.
export function memoryClock(seed = 0, iso = "1970-01-01T00:00:00.000Z"): ClockSource {
  let v = seed;
  return {
    nextVersion: () => (++v) as Version,
    now: () => iso, // deterministic for tests; a prod adapter returns the real ISO time
  };
}
