# Phase 14 — AI Camera + AI Business Intelligence

AI runs as an **isolated service layer** (`packages/ai` + `apps/api/src/services/ai-service.ts`). React only calls HTTP APIs.

## AI Camera

Flow: Camera → image/signals → AI recognition → catalog matching → price + stock → POS (manual confirm).

Identifies when possible: product, brand, company, model, variant, size, color, watt, specifications, unit.

If exact match unavailable: similar products, manual selection, manual search, new product option.

**Guards**

- Confidence threshold (default `0.78`, configurable)
- `allowAutoSell = false` always
- `allowAutoCreate = false` always — AI never creates products

UI: `/ai-camera` · API: `POST /api/v1/ai/recognize-product`, `POST /api/v1/ai/recognize-product/confirm`

## AI Business Intelligence

| Capability | Kind |
|------------|------|
| Sales prediction | `sales_prediction` |
| Fast / slow / stagnant (configurable days) | `velocity` |
| Demand forecast (week / month / seasonal) | `demand_forecast` |
| Purchase recommendation | `purchase_recommendation` |
| Customer purchase combinations | `customer_patterns` |
| Profit optimization | `profit_optimization` |

Every insight includes `explanations` and `sources` (table-level traceability).

UI: `/ai-insights` · API: `GET|POST /api/v1/ai/insights`, `GET|PUT /api/v1/ai/settings`

## Permissions

`ai.recognize`, `ai.insights`, `ai.manage`

## Verify

```bash
npm run build:packages
npm run test:phase14
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
