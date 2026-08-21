/**
 * Canonical POS transaction source of truth.
 *
 * UI panels display and collect input. They must NOT invent financial results.
 * Server re-validates on post. Prefer these domain entry points over ad-hoc math.
 *
 * Pipeline:
 *   POS SESSION → SALE DRAFT (cart) → ITEMS → DISCOUNTS/TAXES → TOTALS
 *   → PAYMENT PREP → VALIDATE → POST (SaleTransactionService) → INVOICE
 *   → STOCK / AR / PAYMENTS → post-commit side effects
 */

export const POS_TRANSACTION_PIPELINE = [
  "session",
  "draft_cart",
  "line_pricing",
  "discounts",
  "tax",
  "totals",
  "payment_prep",
  "checkout_validation",
  "post_sale",
  "stock_movement",
  "customer_ledger",
  "invoice",
  "post_commit_side_effects",
] as const;

export type PosTransactionPipelineStep = (typeof POS_TRANSACTION_PIPELINE)[number];

/**
 * Map of business concern → canonical domain module (packages/domain).
 * Keep this list honest: if a concern is not listed, do not invent a second engine in the UI.
 */
export const POS_SOURCE_OF_TRUTH = {
  cartMutations: "pos-cart.ts",
  stockGate: "pos-stock-availability.ts",
  linePricing: "pos-pricing.ts",
  lineDiscount: "pos-discount.ts",
  discountPolicy: "discount-policy.ts",
  tax: "pos-tax.ts",
  totals: "sale-totals.ts (via calculatePosCartTotals → calculateSaleTotals)",
  paymentPrep: "pos-payment.ts (preparePosPayments)",
  checkoutValidation: "pos-validation.ts",
  customerCredit: "pos-customer.ts + credit.ts",
  holdSnapshot: "pos-hold.ts",
  salePosting: "sale-transaction.ts (SaleTransactionService.postSale)",
  returns: "pos-return.ts",
  exchange: "pos-exchange.ts",
  installments: "installments.ts (schedule math; plan create is post-commit)",
  quotationsTotals: "quotation-lifecycle.ts → calculateSaleTotals",
  paymentRegisterDisplay: "payment-register.ts (display only — not a sale writer)",
  coupons: "pos-coupon.ts → invoice discount via sale-totals / SaleTransactionService",
  cashMovements: "pos-cash-movement.ts → pos_cash_movements + shift expected cash",
  dayClosing: "pos-day-close.ts → pos_day_closings auditable record",
} as const;

/** Concerns that must never be calculated only in React components. */
export const POS_UI_MUST_NOT_OWN = [
  "grand_total",
  "tax_total",
  "paid_toward_bill",
  "change_due",
  "remaining_due",
  "stock_availability_decision",
  "credit_limit_decision",
  "idempotent_sale_post",
] as const;
