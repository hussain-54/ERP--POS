# POS Architecture (Phase 2)

## Boundaries

```
React UI (components)
    ↓
POS session state (usePosSession) — single cart + customer session
    ↓
Domain (@electronic-erp/domain) — pos-cart, sale-totals, discount-policy, sale-transaction
    ↓
pos-api / client repository — HTTP only
    ↓
Express /api/v1/pos → PosRepository (packages/db)
    ↓
Supabase (online)  |  OfflinePosEngine → SQLite outbox → sync → PosRepository
```

## Single sources of truth

| Concern | Active source | Do not use for production |
|---------|---------------|---------------------------|
| Cart (terminal) | `usePosSession` + `packages/domain/src/pos-cart.ts` | Duplicate useState math in components |
| Customer (terminal) | `usePosSession` | Second customer context |
| Pricing (tier pick) | `pickPriceLevel` in domain | Local pickPrice copies (alias only) |
| Taxes (line) | `taxForLineNet` / `lineTaxAmount` in domain | Inline tax in UI |
| Discounts (policy) | `discount-policy.ts` + API RBAC | Client-only trust |
| Payments (post) | `SaleTransactionService` ports | Direct ledger writes from UI |
| Sales | `SaleTransactionService` + `PosRepository.postSale` | OfflinePosStore (tests only) |
| Inventory (sale stock) | Sale ports → stock ledger | Direct stock updates from UI |
| Holds | `PosRepository` held_sales via posApi | — |
| Returns | `PosRepository.postReturn` via posApi | — |
| Offline sales | `OfflinePosEngine` (SQLite) | `OfflinePosStore` in-memory |

## Rules

1. Calculations must not live in React components — use domain `pos-cart` / `sale-totals`.
2. Components must not call Supabase or SQLite.
3. Do not add a second cart store or second customer store.
4. Do not replace Supabase or remove SQLite/offline.
5. Do not introduce a second sale writer alongside `SaleTransactionService` / `OfflinePosEngine`.
