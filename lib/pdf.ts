// Server-side PDF text extraction. Imports pdf-parse's lib entry directly to
// avoid the package's index.js debug self-test (which reads a bundled test file
// and breaks in serverless bundles). Returns extracted text, or "" on failure.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod: any = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = mod.default || mod;
    const data = await pdf(buffer);
    return (data?.text || "").trim();
  } catch (e) {
    console.error("pdf extraction failed:", e);
    return "";
  }
}
