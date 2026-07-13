# Runbook: One-time / owner admin actions

All run from the OWNER's browser console while signed in as ADMIN (username `CEOGABRIEL`). All idempotent unless noted.

| Action | Console call | Status |
|---|---|---|
| Encrypt legacy Letter fields (G-11/G-13 backfill) | `fetch('/api/admin/encrypt-letters',{method:'POST'}).then(r=>r.json()).then(console.log)` | ⏰ PENDING (NEEDS CONFIRMATION) |
| Encrypt legacy Report.rawText | same pattern → `/api/admin/encrypt-reports` | NEEDS CONFIRMATION if run |
| Apply additive schema via legacy migrate | `/api/admin/migrate` POST | as-needed |
| Sync Stripe catalog | Admin UI → Billing → "Sync products to Stripe" | as-needed |
| Fetch Brief news manually | Admin UI → `/admin/brief` → "Fetch latest news" | as-needed |
| Send test digest (after `COMPANY_POSTAL_ADDRESS` set) | Admin UI → `/admin/brief` → "Send test digest" | ⏰ blocked on env var |

Verify a Stripe charge: dashboard → webhook destination → Event deliveries → expect `200`.
