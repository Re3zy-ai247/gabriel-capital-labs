import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { extractPdfText } from "@/lib/pdf";
import { analyzeResponse } from "@/lib/round2";
import { AiSpendRefusal, withAiPrincipal } from "@/lib/aiMeter";
import { boundBodySize } from "@/lib/bodyBounds";
import { enforceRateLimit } from "@/lib/rateLimit";
import { encryptText, decryptText } from "@/lib/docCrypto";
import { recordKaiEvent } from "@/lib/kaiEvents";
import { recordVerifiedOutcome } from "@/lib/outcomeLedger";
import { canTransitionLetter } from "@/lib/letter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// The 15 MB cap is the number the consumer is told, and it is the per-FILE cap.
// The multipart framing and the pasted-text field ride on top of it, so the
// pre-buffer gate allows 1 MB of slack — a real 15 MB PDF must not be refused by
// the gate that exists to refuse a 500 MB one. Same numbers as
// app/api/reports/upload/route.ts, the other consumer PDF entry point.
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES + 1024 * 1024;
const TOO_LARGE = "File too large (max 15 MB).";

// Logs the bureau/furnisher response to a letter (pasted text or PDF), runs AI
// analysis to assess the outcome + escalation angles, and marks the letter
// RESPONSE_RECEIVED.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This route runs an AI analysis (analyzeResponse) — cap it per user so it
  // can't be spammed for cost/abuse, mirroring the other AI endpoints
  // (letters/generate, strategist, kai).
  //
  // RC1-S11 (review B-4): this comment used to end "Fails open." Since P0-10 the
  // limiter fails CLOSED (lib/rateLimit.ts) — a store that cannot answer refuses
  // the request rather than waving it through. On the route the same review
  // named as the product's weakest spend surface, a comment that understates the
  // control is how the control gets loosened later.
  const limited = await enforceRateLimit(`letters-response:${user.id}`, 20, 3600);
  if (limited) return limited;

  const letter = await prisma.letter.findFirst({ where: { id: params.id, userId: user.id } });
  if (!letter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ---- RC1-S5 REMEDIATION (review M-5): THE SAME LIFECYCLE, EVERY WRITER ----
  // This route writes `status: "RESPONSE_RECEIVED"`, and PATCH /api/letters/[id]
  // allows RESPONSE_RECEIVED → RESOLVED, where the outcome "corrected or
  // removed" writes `tradeline.resolved = true` — read by lib/missionControl.ts,
  // the strategist and the admin dashboard. Written from any state, this route
  // was therefore a way to report a dispute as resolved on a letter that was
  // never approved and never mailed. It now answers to the shared transition
  // map (lib/letter.ts), so a response can only be logged against a letter that
  // actually went out. Checked BEFORE the PDF is read and before any AI call.
  if (!canTransitionLetter(letter.status, "RESPONSE_RECEIVED")) {
    return NextResponse.json(
      {
        error:
          letter.status === "RESOLVED"
            ? "This dispute is already closed out. Reopen it by starting a new round if another response arrived."
            : "Mark this letter mailed first — a response can only be logged against a dispute that actually went out.",
        invalidTransition: true,
        from: letter.status,
      },
      { status: 409 }
    );
  }

  // ---- RC1-S11 (review B-2): BOUND THE BODY BEFORE IT IS BUFFERED ----------
  // `req.formData()` reads the WHOLE body into memory, so the per-file
  // `f.size > 15 MB` check below could only ever fire after the bytes had
  // already been consumed — verbatim the E-05 defect that was closed at the
  // other consumer PDF entry point (/api/reports/upload) with this same helper.
  // A chunked body with no content-length is covered too: with no trustworthy
  // declared length the stream is metered and errored past the cap, so parsing
  // aborts mid-transfer. Same 15 MB the consumer is told, same 413.
  // ---- RC1-S11 (review B-1, second half): ONE RESPONSE, ONE ANALYSIS -------
  // `LETTER_TRANSITIONS.RESPONSE_RECEIVED` includes RESPONSE_RECEIVED itself, so
  // the lifecycle check above passes on every repeat and nothing else re-checked:
  // one mailed letter could drive the paid analysis model 20×/hour forever.
  //
  // The guard is on `responseAt` — the evidence that a response was already
  // logged — NOT on the transition list, deliberately. That self-transition is
  // what makes a PATCH to the status a letter already holds idempotent
  // (app/api/letters/[id]/route.ts), and removing it would turn a harmless
  // repeat PATCH into a 409. Guarding the data instead makes the AI call
  // non-replayable whatever the status says.
  //
  // Legitimate re-analysis stays coherent: a bureau reply arrives once, and a
  // FURTHER reply belongs to the next round — which is a new letter, with its
  // own response slot. What this refuses is re-running the analysis over the
  // same letter, which is the only thing the replay bought.
  //
  // RC1-S11 (review NEW-3) — AND IT LOCKS ON THE ANALYSIS, NOT ON THE LOG.
  // Keyed on `responseAt` alone, this guard composed with its own sibling into a
  // trap: the refusal path below wrote `responseAt` even when the budget refused
  // or the provider errored, so an assessment that never happened could never
  // happen. Our failure, permanently charged to the consumer, with no reset path
  // anywhere and the Log-response control gone from the page.
  //
  // The predicate is now "already logged AND already analysed". What the paid
  // call cost is the ANALYSIS, so that is what may not be replayed; a reply that
  // was never analysed is exactly the one the consumer must be able to retry.
  // Retrying does not reopen the replay hole: a retry that succeeds writes the
  // analysis and locks, and a retry that fails is either a refusal (which spends
  // nothing, by design) or an error — with the 20/hour limiter still over both.
  if (letter.responseAt && letter.responseAnalysis) {
    return NextResponse.json(
      {
        error:
          "A response is already logged and read for this letter. If they wrote again, draft the next round — that reply belongs to it.",
        alreadyLogged: true,
        responseAt: letter.responseAt,
      },
      { status: 409 }
    );
  }

  let responseText = "";
  const bounded = boundBodySize(req, MAX_BODY_BYTES);
  if (!bounded.ok) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await bounded.req.formData();
      responseText = String(form.get("text") || "").trim();
      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        if (f.size > MAX_FILE_BYTES) {
          return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
        }
        const pdfText = await extractPdfText(Buffer.from(await f.arrayBuffer()));
        if (pdfText.length > responseText.length) responseText = pdfText;
      }
    } else {
      // Read from the BOUNDED request in both branches. `boundBodySize` returns
      // the original request when a trustworthy content-length let it refuse
      // early, and a metered clone otherwise — and building that clone consumes
      // the original's stream, so reading `req` here would throw "body already
      // read" on every JSON post. A pasted 40 000-character response is a body
      // worth bounding too.
      const body = await bounded.req.json().catch(() => ({}));
      responseText = String(body.text || "").trim();
    }
  } catch (e) {
    // A body that blew the cap mid-stream errors the parser; that is a 413, not
    // a malformed-request 400.
    if (bounded.exceeded.value) {
      return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
    }
    console.error("response parse error", e);
    return NextResponse.json({ error: "Could not read the response." }, { status: 400 });
  }

  if (responseText.length < 15) {
    return NextResponse.json(
      { error: "Paste the bureau's response text (or upload a text-based PDF)." },
      { status: 400 }
    );
  }

  // ---- RC1-S11 (review B-1, first half): SPEND UNDER A PRINCIPAL -----------
  // `analyzeResponse` calls the meter with `userId: null` (lib/round2.ts), and
  // with no principal lib/aiMeter.ts skips reserveDailyBudget ENTIRELY: no
  // reservation, no ceiling, no refusal, and the usage row lands unattributed,
  // invisible to the consumer's own budget and to per-user spend reporting.
  // Opening a scope here attributes every nested model call to this consumer and
  // puts the call inside the same daily ceiling as every other AI surface —
  // exactly what app/api/reports/analyze/route.ts does for report parsing.
  let analysis = null;
  let budgetRefused = false;
  try {
    analysis = await withAiPrincipal(user.id, () => analyzeResponse(decryptText(letter.body), responseText));
  } catch (e) {
    // A budget refusal is not a failure to log the response. The reply is the
    // consumer's own evidence and is still saved; what did not happen is the
    // assessment, and `needsAI` already tells the page to say so rather than
    // imply an analysis ran.
    if (e instanceof AiSpendRefusal) budgetRefused = true;
    console.error("response analysis failed", e);
  }

  // RC1-S11 (review NEW-3) — WRITE WHAT HAPPENED, NOT A PLACEHOLDER FOR IT.
  // `responseOutcome` used to be stamped `"unknown"` whenever no analysis came
  // back. But "unknown" is a DETERMINATION — the model's own vocabulary for "the
  // reply doesn't say" (lib/round2.ts) — and it then travelled into the verified
  // outcome ledger as though the product had read the reply and been unable to
  // tell. When nothing read it, the honest value is no value.
  //
  // `responseAt` IS written: the reply genuinely was logged, and that is what the
  // field means. It is written ONCE, on the first log, so a later retry of the
  // analysis cannot shift the date the consumer's reply arrived — every §611
  // latency estimate anchors on it.
  const updated = await prisma.letter.update({
    where: { id: letter.id },
    data: {
      responseText: encryptText(responseText.slice(0, 200_000)),
      responseOutcome: analysis?.outcome ?? null,
      responseAnalysis: analysis ? encryptText(JSON.stringify(analysis)) : null,
      ...(letter.responseAt ? {} : { responseAt: new Date() }),
      status: "RESPONSE_RECEIVED",
    },
  });

  await recordKaiEvent(user.id, "response.received", {
    refType: "letter",
    refId: letter.id,
    payload: { outcome: updated.responseOutcome, analyzed: analysis !== null },
  });

  // Close the compounding loop: record this verified outcome in the ledger,
  // linked to the recommendation that produced it (Sprint XIV, fail-open).
  //
  // RC1-S11 (review NEW-3): only when there IS an outcome. The ledger is the
  // product's evidence base — what disputes actually achieved — and a row saying
  // "unknown" because our budget ran out is not evidence of anything. The retry
  // that does produce an analysis records it (the ledger upserts per letter, so
  // there is exactly one row either way).
  if (analysis) {
    await recordVerifiedOutcome({
      userId: user.id, letterId: letter.id, tradelineId: letter.tradelineId,
      strategy: letter.strategy, recipientType: letter.recipientType, bureau: letter.targetBureau ?? null,
      round: letter.round, outcome: updated.responseOutcome, mailedAt: letter.mailedAt, responseAt: updated.responseAt,
    });
  }

  return NextResponse.json({
    ok: true,
    outcome: updated.responseOutcome,
    analysis,
    needsAI: analysis === null,
    budgetRefused,
  });
}
