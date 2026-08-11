# Phase 17 — Complete ERP Integration + End-to-End QA

Final enterprise integration phase. No random new features — verify one connected Electrical Store ERP.

## What was verified

| Area | Evidence |
|------|----------|
| Master sale chain | `packages/domain/src/phase17-integration.test.ts` |
| Purchase chain | same + purchase-transaction tests |
| Sale return accounting | balanced return journals |
| Installment / warranty / commission | sale orchestration ports |
| Warehouse transfer lifecycle | transfer + delivery transitions |
| Offline OFF→restart→ON | `packages/offline` Phase 10/17 tests |
| Multi-device concurrent POS | Device A + B sync + shared idempotency |
| Permissions (backend) | `AuthorizationService` + role defaults |
| Report reconciliation | `salesByDimension` / dashboard from facts |
| Failure safety | idempotent sale, password lockout |
| Performance indexes | `20260810000017_phase17_performance_indexes.sql` |
| Security (secrets) | web env has anon only; service role server-side |
| Module checklist | `docs/ERP_MODULE_CHECKLIST.md` — all statuses set |
| Final report | `docs/FINAL_ERP_STATUS.md` |

## Verify

```bash
npm run build:packages
npm run test:phase17
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```

STOP after `docs/FINAL_ERP_STATUS.md` — no Phase 18.
