# POS / Sales — Codebase Audit (Phase 0–1)

**Date:** 2026-08-11  
**Scope:** Read-only audit. No POS UI/business logic rewritten in this phase.  
**Reference image:** Not attached to the audit request — visual QA against the reference must happen when the image is available.

---

## 1. Existing architecture (source of truth)

```
UI (apps/web features/pos)
  → pos-api.ts → Express /api/v1/pos
    → PosRepository (packages/db)
      → SaleTransactionService (packages/domain) via ports
        → stock / ledger / payments / journal / commission / warranty / installment

Offline (apps/desktop + packages/offline)
  → OfflinePosEngine → SQLite + outbox
  → SyncCoordinator → /api/v1/sync/push|pull
```

Documented baseline: `docs/PHASE5_POS_SALES.md`.

---

## 2. POS-related file inventory

### Web UI
| Path | Role | Status |
|------|------|--------|
| `apps/web/src/features/pos/PosPage.tsx` | Terminal: search, cart, pay, hold | Working (form/list UI, not commercial terminal chrome) |
| `apps/web/src/features/pos/ReturnsPage.tsx` | Returns / exchange | Working (UUID-heavy) |
| `apps/web/src/features/pos/InvoicesPage.tsx` | Sales list + JSON invoice | Thin print preview |
| `apps/web/src/features/pos/pos-api.ts` | HTTP client | Working |
| `apps/web/src/features/pos/hardware.ts` | Web HardwareService | Memory/stub adapters |
| `/payments`, `/credit`, `/installments` | Parties UI | Separate from POS terminal |
| `/deliveries` | Delivery notes | Separate module |
| `/salesman`, `/discounts` | Nav entries | **Placeholders** |
| `/offline-pos` | Offline status | Thin indicator only |

### Domain / contracts / DB
| Area | Key files | Status |
|------|-----------|--------|
| Sale orchestration | `packages/domain/src/sale-transaction.ts` | Working (sequential, not single DB txn) |
| Totals | `sale-totals.ts` | Working |
| Discount policy | `discount-policy.ts` | Cashier 5% / manager 15% / owner | Working in domain |
| Split pay | `split-payment.ts` | Working |
| Installments | `installments.ts` | Working |
| Journals | `accounting-posting.ts` | Working |
| Schemas | `packages/contracts/src/sale.ts`, `payment.ts` | Rich |
| Repository | `packages/db/src/repositories/pos-repository.ts` | Working |
| Migration | `supabase/migrations/20260810000005_pos_sales.sql` | Present |

### Offline / sync / hardware / desktop
| Area | Status |
|------|--------|
| SQLite offline sale | Working (`OfflinePosEngine`) |
| Hold offline | Partial (schema/store; desktop IPC limited) |
| Sync push | **Ack only — does not apply sales into cloud POS tables** |
| Hardware ports | Present; real ESC/POS/USB mostly stub/memory |
| Electron IPC | `postOfflineSale`, pending list, print, drawer |

### Tests
| Suite | Coverage |
|-------|----------|
| `sale-transaction.test.ts`, `sale-totals.test.ts`, `phase17-integration.test.ts` | Domain chain (mocked ports) |
| `pos-store.test.ts`, offline sync tests | Offline |
| API e2e against live PosRepository | Missing |
| Sync apply-to-sales | Missing (feature missing) |

---

## 3. Current POS UI structure

Two-column form (not register chrome):

- **Left:** warehouse/customer/salesman UUID fields, price level, search, camera button, result list, advanced manual item
- **Right:** cart lines, invoice discount, payments (easy/advanced), Complete / Hold, held bills list
- **Modes:** Easy | Advanced; EN | UR | EN+UR
- **No dedicated POS sidebar**, no product grid/cards, no customer picker, no shift cash drawer panel, no F-key shortcuts UI

Shell nav is flat ERP modules (`AppShell` + `modules.ts`), not a POS-focused IA.

---

## 4. Design tokens (preserve brand; adapt POS chrome)

Existing (`packages/ui/src/styles.css`):

| Token | Current |
|-------|---------|
| Brand | `#0f6a5c` (teal) |
| Accent | `#c9842d` |
| BG | `#f3f5f7` |
| Ink | `#12202e` |
| Radius | `12px` |

Prompt reference suggests blue primary `#2563EB` + navy sidebar `#172033`.  
**Decision:** keep ERP brand teal for global identity; introduce **POS-local** tokens (navy sidebar, blue primary CTAs) under a POS layout scope so the rest of ERP is not recolored.

---

## 5. Critical gaps / risks (STOP-worthy)

| Risk | Severity | Notes |
|------|----------|-------|
| Offline sync does not materialize cloud sales | **Critical** | Outbox accepted; business tables not applied |
| No Postgres transaction around sale chain | High | Partial failure risk |
| Walk-in payments skipped when no `customerId` | High | Cash walk-in incomplete in repo path |
| Discount RBAC not asserted on POS API | Medium | Trusts client `approverRole` |
| Tax rates (enterprise) not wired to POS cart | Medium | Line tax amounts only |
| UI permission gates missing | Medium | API enforces; buttons still visible |
| Real hardware / GPS delivery | Low–Med | Do not fake; extend ports only |

---

## 6. What must be preserved

- `SaleTransactionService` + ports pattern
- `pos-repository` hold/return/invoice paths
- Contracts schemas
- Offline engine + outbox model
- Existing RBAC keys
- Phase 5 API surface
- Parties payments / installments modules
- Hardware ports abstraction
