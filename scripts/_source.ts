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
//
// S11 CE2-2 — REGEX LITERALS ARE THE THIRD NESTING CONTEXT, and this tokenizer
// had no state for them. `/\/\*/` and `/https:\/\//` both contain what looks
// like a comment opener, so a guard measuring a file that tests comment
// handling — or any regex holding a URL — would have had code silently eaten
// from under its assertions. Latent rather than live, but the self-test below
// asserted "the strip is not blind", and that claim has to be true.
//
// Telling `/` (divide) from `/` (regex opener) needs the preceding token: a
// regex can only START where a value cannot already have ended. `regexAllowed`
// tracks exactly that, and it is deliberately conservative — when in doubt it
// treats the slash as division, which at worst leaves a comment un-stripped
// (a loud, self-announcing failure) rather than eating code (a silent one).
function regexCanStartAfter(out: string): boolean {
  // Walk back over whitespace to the last significant character.
  let j = out.length - 1;
  while (j >= 0 && /\s/.test(out[j])) j--;
  if (j < 0) return true; // start of file
  const prev = out[j];
  // After a value or a closer, `/` is division. After an operator, a comma, an
  // opener, a keyword, or `=>`, it opens a regex.
  if (/[)\]}]/.test(prev)) return false;
  if (/[A-Za-z0-9_$]/.test(prev)) {
    // A word: a KEYWORD can be followed by a regex (`return /x/`), an
    // identifier or literal cannot (`a / b`).
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(out[k])) k--;
    const word = out.slice(k + 1, j + 1);
    return ["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"].includes(word);
  }
  return true; // operator, punctuation, `(`, `,`, `=`, `:` …
}

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
    // A regex literal. Copied through verbatim, including any `/*` or `//` it
    // contains, and including its character class, where an unescaped `/` is
    // legal and must not be read as the terminator (`/[/]/`).
    if (c === "/" && regexCanStartAfter(out)) {
      out += c;
      i++;
      let inClass = false;
      while (i < n && src[i] !== "\n") {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        const closed = src[i] === "/" && !inClass;
        out += src[i];
        i++;
        if (closed) break;
      }
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

  // 6 · REGEX LITERALS (S11 CE2-2). A regex containing a comment opener must
  //     survive intact and must not open a comment.
  const regexWithBlockOpener = ["const re = /\\/\\*/;", "const after6 = 6;"].join("\n");
  const stripped6 = stripComments(regexWithBlockOpener);
  expect("a regex containing `/*` does not open a block comment", stripped6.includes("const after6 = 6;"));
  expect("…and the regex itself is preserved", stripped6.includes("/\\/\\*/"));

  const regexWithLineOpener = ["const url = /https:\\/\\//;", "const after7 = 7;"].join("\n");
  const stripped7 = stripComments(regexWithLineOpener);
  expect("a regex containing `//` does not open a line comment", stripped7.includes("const after7 = 7;"));

  // A `/` inside a character class is not the terminator.
  const regexClass = ["const cls = /[/*]/;", "const after8 = 8;"].join("\n");
  expect("a `/` inside a regex character class is not the terminator",
    stripComments(regexClass).includes("const after8 = 8;"));

  // 7 · DIVISION that looks like a regex must stay division — the converse
  //     failure. If `a / b` were read as a regex opener, everything to the next
  //     `/` would be swallowed as regex text and the real comment after it
  //     would survive, which is the same blindness in reverse.
  const division = ["const ratio = a / b; // trailing note", "const c9 = x / y;", "const after9 = 9;"].join("\n");
  const stripped9 = stripComments(division);
  expect("division is not mistaken for a regex", stripped9.includes("const c9 = x / y;") && stripped9.includes("const after9 = 9;"));
  expect("…and the comment after a division is still stripped", !stripped9.includes("trailing note"));

  // A keyword CAN be followed by a regex, an identifier cannot.
  expect("a regex directly after `return` is recognised",
    stripComments("function f() { return /a\\/\\*b/; }\nconst after10 = 10;").includes("const after10 = 10;"));

  return failures;
}
