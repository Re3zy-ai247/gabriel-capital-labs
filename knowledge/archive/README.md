# Archive — Append-Only Historical Record

## Purpose

The company's permanent historical record. Any domain's retired artifacts enter here and **never change again**.

Archive is not a domain. It is a **lifecycle state** — a document belongs to exactly one domain and is in exactly one of two states: active, or archived.

## Canonical files

`<year>/<domain>/<original-path>` — where *original path* means the path the document occupied in the active tree **at the moment it was archived**. Provenance is legible from location alone.

A 2026 Founder Library volume archived in 2031 lands at `archive/2031/founder-library/books/book-01-foundation/VOLUME-...md`.

**Path collisions** — most likely two `README.md` files superseded from the same source path in one year — are resolved by appending a disambiguating segment, `<dirname>/<YYYY-MM-DD>-<slug>/<filename>`. Writing a new, differently-named entry is an *append* and is permitted. Never resolve a collision by overwriting.

## Generated artifacts

**None, and none arrive.** Release artifacts are archival in status the moment they are written, but they **never relocate** — they stay at `releases/<domain>/<version>/` permanently, because moving them would break every citation pointing at them. Architecture §8, "What does not enter."

## Ownership

**Owner:** Corporate. Archiving is authorised, dated, and logged.
**Classification:** Inherits the highest class of anything stored here — assume Restricted until a per-subtree declaration says otherwise (Architecture §5.1).

## Rules

1. **Append-only.** Write once. Never edit, never delete, never reorganise.
2. Every archived document carries a header note: date archived, reason, superseding document if any, who authorised it, and its **path history** — so a reference written against an older path still resolves.
3. Archiving is an event and is logged in the originating domain's revision log.
4. **If a document is still consulted, it is not archived** — it is active. Archive is not a wastebasket. This is why a Founder Library volume marked *Superseded* stays active: Volume 0 defines it as primary evidence of what the company believed before it changed its mind, and that is consulted by definition.
5. Retention is permanent. The company does not prune its own history.
6. **The one exception is Compelled Removal** (Architecture §8.1): legally mandated erasure, a court order, a committed secret, or a legally required retraction — executed only on written authorisation, and always leaving a permanent tombstone. The removal becomes part of the record. Nothing else may ever be removed.

## Version policy

Frozen. An archived document's version is whatever it held when archived, forever.

## Do not

- **Do not** modify anything in this tree. The only removal this architecture permits anywhere is a Compelled Removal under rule 6 — founder-authorised, counsel-determined, tombstoned. There is no other route, and convenience is never one.
- **Do not** delete from the archive on any other basis, including tidiness, embarrassment, or a belief that something is obsolete.
- **Do not** reorganise archived paths — provenance is carried by location.
- **Do not** archive something still in use to make a directory look tidier.

---

*Governed by [Knowledge Architecture 1.0](../ARCHITECTURE.md). Changes to the architecture are Corporate decisions.*
