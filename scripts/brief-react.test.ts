// Run: npx tsx scripts/brief-react.test.ts
// Guards the reaction-kind validator used at the /api/brief/react input boundary —
// only 'like' and 'bookmark' may ever reach the DB write.
import { isBriefReactionKind, BRIEF_REACTION_KINDS } from "../lib/briefShared";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) pass++;
  else { fail++; console.error(`FAIL: ${label}`); }
}

check("accepts 'like'", isBriefReactionKind("like"));
check("accepts 'bookmark'", isBriefReactionKind("bookmark"));
check("kinds list is exactly like+bookmark", BRIEF_REACTION_KINDS.join(",") === "like,bookmark");
check("rejects empty", !isBriefReactionKind(""));
check("rejects unknown kind", !isBriefReactionKind("love"));
check("rejects case variant", !isBriefReactionKind("Like"));
check("rejects non-string", !isBriefReactionKind(null));
check("rejects object", !isBriefReactionKind({ kind: "like" }));
check("rejects SQL-ish junk", !isBriefReactionKind("like; DROP TABLE"));

console.log(`\nbrief-react.test.ts: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
