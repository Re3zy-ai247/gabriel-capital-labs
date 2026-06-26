// Run: npx tsx scripts/brief-digest.test.ts
// Guards the unsubscribe-token signer: a one-click unsubscribe link must identify
// the right user and reject any tampering (the token authorizes a state change
// with NO login, so forgery resistance is the security boundary).
process.env.NEXTAUTH_SECRET = "test-secret-for-digest-tokens";
import { digestToken, verifyDigestToken } from "../lib/briefDigest";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

const id = "clx9user_ABC-123";
const tok = digestToken(id);

check("round-trips to the same user id", verifyDigestToken(tok) === id);
check("different users -> different tokens", digestToken("a") !== digestToken("b"));
check("rejects empty", verifyDigestToken("") === null);
check("rejects garbage", verifyDigestToken("not-a-token") === null);
check("rejects payload with no signature", verifyDigestToken(Buffer.from(id).toString("base64url")) === null);

// Tampered signature (flip the last 2 chars).
const tail = tok.slice(-2) === "aa" ? "bb" : "aa";
check("rejects a tampered signature", verifyDigestToken(tok.slice(0, -2) + tail) === null);

// Tampered payload (swap the user id but keep the old signature).
const sig = tok.split(".")[1];
const forged = Buffer.from("clx9user_EVIL").toString("base64url") + "." + sig;
check("rejects a forged payload (id swapped, old sig)", verifyDigestToken(forged) === null);

console.log(`\nbrief-digest.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
