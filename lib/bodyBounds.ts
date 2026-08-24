// A body-size bound that holds whether or not the client declares one.
//
// RC1-S11 (review B-2). The bound below was written for /api/reports/upload
// (P1-20 / E-05, then M-5) and lived as a private function inside that route.
// The release gate found the SECOND consumer PDF ingestion point —
// app/api/letters/[id]/response — calling `req.formData()` with no pre-buffer
// gate at all, reproducing the original defect verbatim: the per-file
// `f.size > 15 MB` check can only run once the whole body is already in memory.
//
// The logic is unchanged from the reviewed original; it is here so both entry
// points share ONE implementation instead of two that can drift.
// app/api/reports/upload/route.ts is owned by another slice and still carries
// its own copy; the routed follow-up is to delete that copy and import this.
//
// WHY IT IS SHAPED THIS WAY. The first version of the gate only read
// `content-length` and, because `Number.isFinite(NaN)` is false, let anything
// WITHOUT that header straight through to the parser. A chunked or HTTP/2
// request that omits the header therefore reproduced E-05 exactly. A declared
// length is also only a claim; nothing forces the body to match it.
//
// So: trust the header only to REFUSE early, never to admit. When no
// trustworthy length is present, the body is piped through a counter that
// errors the stream past the cap, so parsing aborts mid-transfer instead of
// after it.
export type BoundedBody =
  | { ok: true; req: Request; exceeded: { value: boolean } }
  | { ok: false };

export function boundBodySize(req: Request, maxBodyBytes: number): BoundedBody {
  const declared = Number.parseInt(req.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared)) {
    // Cheapest possible refusal: no allocation, no read of the body at all.
    if (declared > maxBodyBytes) return { ok: false };
    return { ok: true, req, exceeded: { value: false } };
  }

  const source = req.body;
  // A multipart POST with neither a declared length nor a readable body is not
  // a shape we can bound. Fail closed rather than hand it to the parser.
  if (!source) return { ok: false };

  const exceeded = { value: false };
  let seen = 0;
  const metered = source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBodyBytes) {
          exceeded.value = true;
          controller.error(new Error("request body exceeded the size cap"));
          return;
        }
        controller.enqueue(chunk);
      },
    })
  );
  const bounded = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: metered,
    // Required by undici for a streaming request body.
    duplex: "half",
  } as RequestInit);
  return { ok: true, req: bounded, exceeded };
}
