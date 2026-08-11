# Phase 12 — Dashboard + Reporting + Business Intelligence

All reports respect **organization**, **branch**, **warehouse**, **permissions**, and **date filters**.

## Executive dashboard

`GET /api/v1/reports/dashboard/executive`

KPIs: sales, purchases, gross/net profit, cash, bank, receivables, payables, stock value, low/out/overstock, today’s expenses, installments due, customer/supplier outstanding, pending approvals/deliveries/repairs, warranty claims, online orders, sales/purchase growth, profit series, recent transactions.

UI: `/`

## Filters

Period: today | yesterday | week | month | year | custom  
Dimensions: branch, warehouse, salesman, category, brand

## Report APIs

| Family | Route |
|--------|-------|
| Sales | `GET /api/v1/reports/sales/:dimension` |
| Purchases | `GET /api/v1/reports/purchases/:dimension` |
| Stock | `GET /api/v1/reports/stock/:kind` |
| Profit | `GET /api/v1/reports/profit/:kind` |
| Accounting | `GET /api/v1/reports/accounting/:kind` |
| BI | `GET /api/v1/reports/bi/:metric` |
| Catalog | `GET /api/v1/reports/catalog` |

UI: `/reports`, `/bi`

## Permissions

`dashboard.view`, `dashboard.view_finance`, `dashboard.view_all_branches`, `reports.view`, `reports.export`, `reports.sales`, `reports.purchases`, `reports.stock`, `reports.profit`, `reports.finance`, `bi.view`, `bi.view_all_branches`

## Domain

Pure engines in `packages/domain/src/reporting.ts` (date ranges, growth, margin, turnover, aggregations).

## Verify

```bash
npm run build:packages
npm run test:phase12
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
