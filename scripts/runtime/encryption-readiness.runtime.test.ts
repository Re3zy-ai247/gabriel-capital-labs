// Run: npx --no-install tsx scripts/runtime/encryption-readiness.runtime.test.ts
//
// S11 · MEDIUM_BLOCKING-1 (encryption) and X-1 / X-6 (migrations) — a readiness
// probe must be able to go red for the dependencies that take a core consumer
// flow to zero, and the routes that need them must fail fast and truthfully.
//
// THE DEFECT. `app/api/reports/upload/route.ts` was the ONE encrypting route with
// no `docCryptoReady()` check (documents, documents/[id]/raw, attachments and
// identity/discrepancies all have one). With `DOCUMENT_ENCRYPTION_KEY` absent or
// the wrong length, `encryptText()` threw inside the NDJSON stream, the generic
// catch swallowed it, the half-written report was deleted, and the consumer was
// told "the analysis hit a snag on our side". 100% of intake down — and
// `/api/health/ready` answered `{"status":"ready","db":"ok"}` throughout, so the
// one signal an operator watches actively concealed the outage.
//
// Two halves, both asserted here by EXECUTING the real handlers:
//   (a) the upload route refuses fast and truthfully when the key is unusable;
//   (b) readiness cannot report "ready" while every upload is guaranteed to fail.
//
// Offline. No database, no network, no real key.
import { check, loadModule, mockModule, run, section } from "./_harness";

process.env.PDF_MAX_PAGES = "3";
// The readiness probe memoises its database round-trip for 5 s (lens-B LOW: the
// route is unauthenticated, so a flood must not be one query per request). This
// guard flips the underlying state deliberately and must observe each flip, so it
// turns the memo off rather than sleeping through it.
process.env.HEALTH_READY_DB_TTL_MS = "0";

// A synthetic 32-byte hex key. Not a secret: it exists only inside this process
// and encrypts nothing but the fixture below.
const TEST_KEY = "11".repeat(32);

type Json = Record<string, unknown>;
const calls: string[] = [];

let dbThrows = false;
// Which of the migration-only tables the fake database has. A restored or
// mis-ordered deployment has neither; `to_regclass` answers NULL for an absent
// relation rather than throwing, which is exactly why the probe can ask.
let presentTables = new Set<string>(["TermsAcceptance", "ConsumerAssertion"]);
mockModule("lib/prisma.ts", {
  prisma: {
    $queryRaw: async () => {
      calls.push("db.schemaProbe");
      if (dbThrows) throw new Error("guard: database unreachable");
      return [
        {
          terms: presentTables.has("TermsAcceptance") ? "public.TermsAcceptance" : null,
          assertion: presentTables.has("ConsumerAssertion") ? "public.ConsumerAssertion" : null,
        },
      ];
    },
    report: {
      create: async ({ data }: { data: Json }) => {
        calls.push("report.create");
        return { id: "report_1", ...data };
      },
      delete: async () => {
        calls.push("report.delete");
        return {};
      },
    },
    tradeline: { findMany: async () => [] },
  },
});
mockModule("lib/session.ts", { currentUserOrDemo: async () => ({ id: "user_1", email: "c@example.test" }) });
mockModule("lib/rateLimit.ts", { enforceRateLimit: async () => null });
mockModule("lib/analyze.ts", {
  analyzeReportText: async () => {
    calls.push("analyzeReportText");
    return { tradelines: 0, usedAI: false };
  },
});
mockModule("lib/kaiEvents.ts", { recordKaiEvent: async () => {} });
mockModule("lib/events.ts", { track: async () => {}, PRODUCT_EVENTS: { reportUploaded: "report.uploaded" } });
mockModule("lib/bureauData.ts", { getBureauData: () => ({}), crossBureauConflicts: () => [] });
mockModule("lib/recommend.ts", { recommendStrategy: () => null });
mockModule("lib/aiMeter.ts", {
  withAiPrincipal: async (_id: string, fn: () => Promise<unknown>) => fn(),
  // S11 · NEW-1: the upload now pre-flights the spend ceilings so a refused AI
  // read can be disclosed. These guards are about bounds and readiness, so the
  // double reports budget available; the refusal path itself is proven in
  // scripts/runtime/ai-spend-control.runtime.test.ts against the real meter.
  assertAiBudgetAvailable: async () => {},
  // The probe now takes the estimate of the call it fronts (S11 · B-R3-1), so the
  // double has to supply one; the band behaviour itself is proven against the real
  // meter in scripts/runtime/ai-spend-control.runtime.test.ts.
  reportParseEstimateUsd: () => 0.21,
  AiSpendRefusal: class AiSpendRefusal extends Error {},
});

const uploadRoute = loadModule<{ POST(req: Request): Promise<Response> }>("app/api/reports/upload/route.ts");
const readyRoute = loadModule<{ GET(): Promise<Response> }>("app/api/health/ready/route.ts");

// A real PDF the route will accept, so nothing but the key decides the outcome.
function buildPdf(pageCount: number): Buffer {
  const objects: string[] = [];
  const kids = Array.from({ length: pageCount }, () => "3 0 R").join(" ");
  const streamText = "BT /F1 12 Tf 72 720 Td (CAPITAL ONE 1234 CHARGE OFF BALANCE 500 REPORTED) Tj ET";
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Count ${pageCount} /Kids [ ${kids} ] >>`);
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>");
  objects.push(`<< /Length ${streamText.length} >>\nstream\n${streamText}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const PDF = buildPdf(9_000);

function uploadRequest() {
  const bytes = PDF;
  return {
    headers: {
      get: (k: string) =>
        ({ "content-type": "multipart/form-data; boundary=----g", "content-length": "4096" })[k.toLowerCase()] ?? null,
    },
    async formData() {
      calls.push("req.formData");
      return {
        get(key: string) {
          if (key === "bureaus") return "EQUIFAX";
          if (key === "file") {
            return {
              name: "report.pdf",
              size: bytes.length,
              slice(from: number, to: number) {
                const part = bytes.subarray(from, to);
                return { arrayBuffer: async () => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) };
              },
              async arrayBuffer() {
                return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
              },
            };
          }
          return null;
        },
      };
    },
    async json() {
      return {};
    },
  } as unknown as Request;
}

run("encryption-readiness.runtime.test.ts", async () => {
  section("(a) upload refuses fast and truthfully when the key is unusable");
  delete process.env.DOCUMENT_ENCRYPTION_KEY;
  calls.length = 0;
  const noKey = await uploadRoute.POST(uploadRequest());
  check("a missing DOCUMENT_ENCRYPTION_KEY refuses with 503, not a stream", noKey.status === 503);
  check("the body is never even read", !calls.includes("req.formData"));
  check("nothing is written and nothing is deleted", !calls.includes("report.create") && !calls.includes("report.delete"));
  const noKeyBody = (await noKey.json()) as Json;
  const msg = String(noKeyBody.error ?? "");
  check("the copy says the fault is ours", /on our side|isn't available on our side/i.test(msg));
  check("it does not blame the consumer's report or credit", /nothing about your report or your credit/i.test(msg));
  check("it is not the old generic 'hit a snag' message", !/hit a snag/i.test(msg));
  check("it promises nothing about credit outcomes", !/delet|remove|improve|score|guarantee/i.test(msg));

  section("a key of the wrong length is also unusable, and is treated that way");
  process.env.DOCUMENT_ENCRYPTION_KEY = "abcd";
  calls.length = 0;
  const shortKey = await uploadRoute.POST(uploadRequest());
  check("a short key refuses with 503 rather than throwing mid-stream", shortKey.status === 503);
  check("and still never reads the body", !calls.includes("req.formData"));

  section("control — with a usable key the upload proceeds exactly as before");
  process.env.DOCUMENT_ENCRYPTION_KEY = TEST_KEY;
  calls.length = 0;
  const ok = await uploadRoute.POST(uploadRequest());
  check("a usable key lets the upload through", ok.status === 200);
  await ok.text();
  check("the body was read, the report persisted and the analysis ran",
    calls.includes("req.formData") && calls.includes("report.create") && calls.includes("analyzeReportText"));

  section("(b) readiness cannot report 'ready' while intake is guaranteed to fail");
  dbThrows = false;
  process.env.DOCUMENT_ENCRYPTION_KEY = TEST_KEY;
  const healthy = await readyRoute.GET();
  const healthyBody = (await healthy.json()) as Json;
  check("everything up: 200", healthy.status === 200);
  check("and it says so, naming both dependencies",
    healthyBody.status === "ready" && healthyBody.db === "ok" && healthyBody.encryption === "ok");

  delete process.env.DOCUMENT_ENCRYPTION_KEY;
  const noKeyReady = await readyRoute.GET();
  const noKeyReadyBody = (await noKeyReady.json()) as Json;
  check("key absent: the probe goes RED (this is the finding)", noKeyReady.status === 503);
  check("it never claims 'ready'", noKeyReadyBody.status !== "ready");
  check("it names encryption as the unavailable dependency", noKeyReadyBody.encryption === "unavailable");
  check("and it still reports the database honestly", noKeyReadyBody.db === "ok");
  check("no secret value is ever echoed", !JSON.stringify(noKeyReadyBody).includes(TEST_KEY));

  dbThrows = true;
  process.env.DOCUMENT_ENCRYPTION_KEY = TEST_KEY;
  const dbDown = await readyRoute.GET();
  const dbDownBody = (await dbDown.json()) as Json;
  check("database down still goes red (unchanged)", dbDown.status === 503 && dbDownBody.db === "unreachable");
  check("and does not leak error internals", !/guard: database unreachable/.test(JSON.stringify(dbDownBody)));
  dbThrows = false;
  process.env.DOCUMENT_ENCRYPTION_KEY = TEST_KEY;

  section("(c) X-1 — a deployment that landed before `prisma migrate deploy` must be REFUSED");
  // TermsAcceptance and ConsumerAssertion are created only by a reviewed
  // migration and have no self-heal gate. Promote the code first and
  // POST /api/register throws with no try/catch: nobody can create an account.
  // Before this, the probe answered {"status":"ready","db":"ok"} throughout.
  for (const missing of ["TermsAcceptance", "ConsumerAssertion"]) {
    presentTables = new Set(["TermsAcceptance", "ConsumerAssertion"].filter((t) => t !== missing));
    const res = await readyRoute.GET();
    const body = (await res.json()) as Json;
    check(`${missing} absent: the probe goes RED`, res.status === 503);
    check(`${missing} absent: it never claims 'ready'`, body.status !== "ready");
    check(`${missing} absent: schema is reported incomplete`, body.schema === "incomplete");
    check(
      `${missing} absent: the operator is told WHICH table is missing`,
      Array.isArray(body.missingTables) && (body.missingTables as string[]).includes(missing)
    );
    check(`${missing} absent: the database itself is still reported reachable`, body.db === "ok");
  }

  presentTables = new Set<string>();
  const noneRes = await readyRoute.GET();
  const noneBody = (await noneRes.json()) as Json;
  check("a fresh restore with neither table is refused", noneRes.status === 503);
  check("and both are named", Array.isArray(noneBody.missingTables) && (noneBody.missingTables as string[]).length === 2);

  presentTables = new Set(["TermsAcceptance", "ConsumerAssertion"]);
  const restored = await readyRoute.GET();
  const restoredBody = (await restored.json()) as Json;
  check("once the migrations are applied the probe goes green again", restored.status === 200);
  check("and no missingTables key is emitted when nothing is missing", restoredBody.missingTables === undefined);
  check("the probe reports every dependency it checked",
    restoredBody.db === "ok" && restoredBody.encryption === "ok" && restoredBody.schema === "ok");
});
