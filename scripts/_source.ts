// Shared source-reading helper for the standalone `scripts/*.test.ts` guards.
//
// WHY THIS FILE EXISTS (S11 addendum 2 — a vacuity hazard, not a tidiness one).
//
// Source-level guards assert both PRESENCE ("the fix is here") and ABSENCE
// ("the defect is gone"). An absence assertion measured on raw source is
// defeated by the comment that explains the absence, because the removed copy
// is quoted in the note recording why it was removed. So every such guard
// strips comments first — and the strip itself then becomes load-bearing:
//
//   · strip too LITTLE and an absence assertion fails for the wrong reason
//     (noisy, but self-announcing — this happened, on a JSX comment);
//   · strip too MUCH and an assertion PASSES over code the guard never saw.
//     That is silent, and it is the vacuity class this program exists to hunt.
//
// The line-based strippers each guard grew independently hit the second case.
// Filtering ` * ` continuation lines BEFORE pairing `/* … */` deletes a JSDoc's
// closing delimiter, leaving its `/**` unterminated — so the block pass then
// consumes everything down to the next `*/` anywhere later in the file,
// swallowing whole function bodies. Reversing the order does not fix it either:
// a `//` comment whose prose contains `/*` (a route glob, say) then opens a
// block that eats the code beneath it.
//
// There is no ordering of line-filters that is correct, because comments and
// strings nest. This is a single tokenizer pass instead: it walks the source
// once, and inside a string literal a comment marker is DATA, not a delimiter.
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    // A quote opens a literal. Comment markers inside it are data — this is
    // what stops `"https://…"` or `"/*"` from opening a comment.
    if (c === '"' || c === "'" || c === "`") {
      out += c;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        const closed = src[i] === c;
        i++;
        if (closed) break;
      }
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue; // the newline itself is preserved by the outer loop
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2; // consume the closing delimiter; an unterminated block ends the file
      continue;
    }
    out += c;
    i++;
  }
  // A JSX comment is `{/* … */}` — the block above removes its interior and
  // delimiters, leaving `{}`, which is inert in JSX and matches nothing.
  return out;
}

/**
 * Proves the stripper is not blind, on the exact shapes that fooled the
 * line-based versions. Returns a list of failures (empty = healthy) so a guard
 * can report them through its own `check()` and fail the suite.
 *
 * This function's own JSDoc block is deliberately here: it is one of the
 * shapes under test.
 */
export function stripCommentsSelfTest(): string[] {
  const failures: string[] = [];
  const expect = (label: string, cond: boolean) => {
    if (!cond) failures.push(label);
  };

  // 1 · A JSDoc block (` * ` continuations + a closing ` */`) followed by real
  //     code that itself contains `*/` inside a STRING. The line-based
  //     stripper deleted the JSDoc terminator, then paired its `/**` with the
  //     `*/` in the string literal below and ate the function whole.
  const jsdocThenCode = [
    "/**",
    " * A doc block.",
    " * @returns nothing",
    " */",
    'export function keepMe() { const glob = "*/"; return glob; }',
    "const alsoKeepMe = 1;",
  ].join("\n");
  const stripped1 = stripComments(jsdocThenCode);
  expect("JSDoc block is removed", !stripped1.includes("@returns"));
  expect("the code after a JSDoc SURVIVES", stripped1.includes("export function keepMe()"));
  expect("a `*/` inside a string literal is data, not a delimiter", stripped1.includes('"*/"'));
  expect("the statement after that code survives too", stripped1.includes("const alsoKeepMe = 1;"));

  // 2 · A line comment whose prose contains `/*` must not open a block.
  const lineCommentWithGlob = ['// posture matches the /review/* routes', "const survivor = 2;"].join("\n");
  expect(
    "a `//` comment containing `/*` does not swallow the code beneath it",
    stripComments(lineCommentWithGlob).includes("const survivor = 2;"),
  );

  // 3 · A `//` sequence inside a string is not a line comment.
  expect(
    "a URL in a string literal is not treated as a comment",
    stripComments('const u = "https://example.test/x"; const after = 3;').includes("const after = 3;"),
  );

  // 4 · JSX comments go, surrounding markup stays.
  const jsx = ["<div>", "  {/* rationale mentioning removedCopy */}", "  <span>kept</span>", "</div>"].join("\n");
  const stripped4 = stripComments(jsx);
  expect("JSX comment interior is removed", !stripped4.includes("removedCopy"));
  expect("markup around a JSX comment survives", stripped4.includes("<span>kept</span>"));

  // 5 · Nothing is removed from comment-free source.
  const clean = 'const a = 1;\nconst b = "two";\n';
  expect("comment-free source is returned unchanged", stripComments(clean) === clean);

  return failures;
}
