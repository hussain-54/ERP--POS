# POS Requirements Matrix (Phase 2+)

Legend: **E** = Exists · **P** = Partial · **M** = Missing · **B** = Broken · **N** = New UI

Updated after remaining-phase pass (2026-08-11).

| Requirement | Status | Notes |
|-------------|--------|-------|
| POS workspace chrome | E | Sidebar/header/grid/cart/pay |
| Search / grid / recent / favorites / categories | E | Favorites persisted; categories from catalog |
| Walk-in + customer + credit due | E | Partial/credit when customer selected |
| Price levels + discount API RBAC | E | Server rewrites approverRole |
| Tax on cart | P | Default tax_rates applied; per-product rates later |
| Split / wallets / credit / installment | E | Installment on advanced POS |
| Hold / shortcuts | E | F1–F8 |
| Invoice 80/58/A4 + WhatsApp/email/print | E | PDF = text+print (no PDF lib) |
| Returns guided | E | |
| Salesman + commission | E | |
| Delivery note from POS | E | No GPS (STOP) |
| Sync apply + desktop coordinator | E | Re-provision for apiUrl |
| Cash shift panel | E | Needs migration `pos_cash_shifts` |
| Manager approval dialog | P | Session permission based, not PIN |
| Atomic sale txn | B/M | Documented limit — sequential writes |
| GPS delivery | M | Not implemented (correct STOP) |
