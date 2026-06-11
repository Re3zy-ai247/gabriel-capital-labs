// pdf-parse ships types for the package root but not the /lib subpath we import
// (to avoid its index.js debug self-test). Declare the subpath module.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdf(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdf;
}
