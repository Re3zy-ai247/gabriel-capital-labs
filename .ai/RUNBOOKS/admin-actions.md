# Runbook: One-time / owner admin actions

All run from the OWNER's browser console while signed in as ADMIN (username `CEOGABRIEL`). All idempotent unless noted.

| Action | Console call | Status |
|---|---|---|
| Encrypt legacy Letter fields (G-11/G-13 backfill) | `fetch('/api/admin/encrypt-letters',{method:'POST'}).then(r=>r.json()).then(console.log)` | ⏰ PENDING (NEEDS CONFIRMATION) |
| Encrypt legacy Report.rawText | same pattern → `/api/admin/encrypt-reports` | NEEDS CONFIRMATION if run |
| Apply additive schema via legacy migrate | `/api/admin/migrate` POST | as-needed |
| Sync Stripe catalog | Admin UI → Billing → "Sync products to Stripe" | as-needed |
| Fetch Brief news manually | Admin UI → `/admin/brief` → "Fetch latest news" | as-needed |
| Send test digest after legal-identity candidate integration | Admin UI → `/admin/brief` → "Send test digest"; inspect received LLC postal block and unsubscribe headers | ⏰ blocked on separate integration/deployment authorization, not on a missing address fact |

Verify a Stripe charge: dashboard → webhook destination → Event deliveries → expect `200`.
