# Phase 13 — CRM + Loyalty + B2B + Online Store

Connected commerce modules sharing ERP customers, products, stock, and sales orders.

## CRM

- Segments with rule JSON (customer type, city, purchases, loyalty tier)
- Customer profile: purchase history, buying patterns, location, customer type
- Campaigns: SMS, WhatsApp, festival, discount, new product, customer-specific
- Run queues `crm_campaign_sends` (provider-agnostic)

UI: `/crm` · API: `/api/v1/crm/*`

## Loyalty

- Earn points from purchases; redeem for discount rewards
- Membership: Silver / Gold / Platinum
- Offers with points cost, expiry, redemption history (`loyalty_ledger`)

UI: `/loyalty` · API: `/api/v1/loyalty/*`

## B2B portal

- Separate portal users linked to wholesale/dealer customers
- Wholesale & dealer price books from customer type
- Bulk orders, credit snapshot, order approval
- Portal: quotations, invoice history, payments, outstanding, reorder

UI: `/b2b` · API: `/api/v1/b2b/*`

## Online store

Flow: Home → Category → Brand → Product → Variant → Cart → Checkout → Order

Product page: images, video, brand, model, size, color, specs, price, stock, warranty

Checkout creates a `sales_orders` row with `channel = online` and reserves ERP stock — **no separate inventory**.

UI: `/online-store` · API: `/api/v1/store/*`

## Testing matrix

| Check | Behavior |
|-------|----------|
| Online order → ERP order | `POST /store/checkout` → `sales_orders` + reservation |
| ERP stock → online availability | Catalog/product uses `stock_balances` |
| Customer → B2B pricing | `POST /b2b/pricing` by customer type |
| Customer payment → ledger | Portal surfaces payments / outstanding |

## Permissions

`crm.view`, `crm.manage`, `loyalty.view`, `loyalty.manage`, `loyalty.redeem`, `b2b.manage`, `b2b.order`, `b2b.approve`, `store.manage`, `store.order`

## Verify

```bash
npm run build:packages
npm run test:phase13
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
