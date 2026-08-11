# Phase 16 — Security + Backup + API + Import/Export

Enterprise infrastructure completion. Sensitive keys (service role, integration secrets) stay server-side — the web app only uses anon key + user JWT.

## Security

- Secure login (existing auth) + password policy + failed-login lockouts
- RBAC (`security.view` / `security.manage`)
- Optional 2FA architecture (enrollment flag; not full authenticator wiring)
- Session list/revoke, login history, activity logs
- Encryption strategy documentation (TLS + provider at-rest)
- Security device registration / approve / revoke
- Secure API via authenticated `/api/v1` + hashed integration keys

UI: `/security` · API: `/api/v1/security/*`

## Backup

Architecture for automatic / daily / local / cloud / incremental jobs, encrypted paths, restore points, restore requests.

**Disaster recovery is not claimed** until restore verification succeeds (`disaster_recovery_claimed = false`; verify-only default).

UI: `/backup` · API: `/api/v1/backup/*`

## Versioned API integrations

Clients for mobile, website, payment gateways, banks, courier, WhatsApp, SMS, accounting, e-commerce — all consume `/api/v1/...`. API key returned once.

UI: `/integrations` · API: `/api/v1/integrations/*`

## Import / Export

| Import | Export |
|--------|--------|
| Excel/CSV (TSV accepted) | CSV, Excel (TSV), PDF |
| products, customers, suppliers, stock, prices | products |

Bulk price updates require pricing/import permission and write `price_change_audits`.

UI: `/import-export` · API: `/api/v1/data/import/*`, `/api/v1/data/export/products`

## Verify

```bash
npm run build:packages
npm run test:phase16
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
