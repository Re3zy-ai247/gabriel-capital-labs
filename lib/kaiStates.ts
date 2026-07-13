// The Kai State Catalog — canonical emotional/behavioral states (Character
// Bible expression law, expanded per founder directive 2026-07-12). Components
// consume this map; assets drop into /assets/kai/expressions and get exported
// to /public/kai/states/<asset>.png without code changes. Until a state's file
// ships, surfaces fall back to the KAI wordmark chip (never a broken image).
//
// Emotional-range law (KAI-CHARACTER-BIBLE): allowed = calm · curious ·
// attentive · focused · pleased · concerned. Never anger, fear, mania,
// sarcasm. "Bad news" renders as steady-and-on-it, not doom.

export type KaiStateId =
  | "idle"
  | "happy"
  | "concerned"
  | "teaching"
  | "celebrating"
  | "reviewing"
  | "analyzing"
  | "waiting"
  | "explaining"
  | "welcoming"
  | "good-news"
  | "bad-news"
  | "congratulations"
  | "thinking"
  | "searching"
  | "listening";

export type KaiState = {
  id: KaiStateId;
  /** Canonical asset name — file lands as /public/kai/states/<asset>.png */
  asset: string;
  /** Which render pose the still derives from (CV-KAI-STATE-* / MASTER). */
  renderBase: string;
  /** One-line art+copy direction; the emotional guardrail for this state. */
  direction: string;
};

export const KAI_STATES: Record<KaiStateId, KaiState> = {
  idle:            { id: "idle",            asset: "Kai-Idle",            renderBase: "STATE-01",            direction: "Neutral seated calm; breathing + blink only. Stillness is the brand." },
  welcoming:       { id: "welcoming",       asset: "Kai-Welcoming",       renderBase: "MASTER-001",          direction: "Front-facing, warm open-mouth smile — the master render's own expression. First-visit and greeting surfaces." },
  happy:           { id: "happy",           asset: "Kai-Happy",           renderBase: "STATE-04 (mild)",     direction: "Pleased and composed — soft smile, tail at rest. Everyday positive, below celebration." },
  "good-news":     { id: "good-news",       asset: "Kai-GoodNews",        renderBase: "STATE-04 (mild)",     direction: "Quiet satisfaction delivering a positive fact. States the fact, then next watch-item — never gloats." },
  celebrating:     { id: "celebrating",     asset: "Kai-Celebrating",     renderBase: "STATE-04 (wag)",      direction: "One wag cycle for a real win (item deleted, dispute resolved), then settle. Understatement is the flex." },
  congratulations: { id: "congratulations", asset: "Kai-Congratulations", renderBase: "STATE-04 (wag)",      direction: "User-milestone variant of celebrating (goal reached, journey complete) + milestone projection. Reserved for terminal wins." },
  concerned:       { id: "concerned",       asset: "Kai-Concerned",       renderBase: "STATE-09 (new render)", direction: "Steady and on it — slowed motion, amber accent on the PANEL never on Kai. Deadlines at risk, errors. Zero fear energy." },
  "bad-news":      { id: "bad-news",        asset: "Kai-BadNews",         renderBase: "STATE-09 (new render)", direction: "Concerned base + direct eye contact: fact, meaning, path forward in one breath. Kai absorbs the blow calmly and hands back a plan." },
  teaching:        { id: "teaching",        asset: "Kai-Teaching",        renderBase: "STATE-02 (tilt)",     direction: "Engaged head tilt toward the user + statute/explainer panel. One transferable concept at a time." },
  explaining:      { id: "explaining",      asset: "Kai-Explaining",      renderBase: "STATE-05/06 (gaze)",  direction: "Gaze leads to the projection carrying the evidence. Claim → receipt → implication." },
  reviewing:       { id: "reviewing",       asset: "Kai-Reviewing",       renderBase: "STATE-08 (down-gaze)", direction: "Focused down-gaze over a document panel — reading the user's material, unhurried." },
  analyzing:       { id: "analyzing",       asset: "Kai-Analyzing",       renderBase: "STATE-08 + grid",     direction: "Working posture while the bureau-grid/panel populates. Caption names the REAL pipeline stage." },
  thinking:        { id: "thinking",        asset: "Kai-Thinking",        renderBase: "STATE-08",            direction: "Calm contemplation, soft off-camera gaze. Replaces spinners on Kai-owned waits." },
  searching:       { id: "searching",       asset: "Kai-Searching",       renderBase: "STATE-08→05→06 loop", direction: "Gaze sweep once per 3s; caption names the retrieval layer actually being searched." },
  waiting:         { id: "waiting",         asset: "Kai-Waiting",         renderBase: "STATE-02 → 01",       direction: "Head tilt toward the user's pending input, settling to idle after 8s. Patient, never nagging." },
  listening:       { id: "listening",       asset: "Kai-Listening",       renderBase: "STATE-10 (new render)", direction: "Ears fully forward, eyes to the input surface. Active attention while the user types/speaks." },
};

/** Web path a state's still will be served from once exported. */
export function kaiStateSrc(id: KaiStateId): string {
  return `/kai/states/${KAI_STATES[id].asset}.png`;
}

/** States that still need a dedicated render (everything else derives from the approved 8 + master). */
export const KAI_STATES_NEEDING_RENDER: KaiStateId[] = ["concerned", "bad-news", "listening"];
