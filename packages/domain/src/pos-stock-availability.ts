import { compareDecimal } from "@electronic-erp/contracts";

/**
 * POS search stock semantics:
 * - No stock_balances row → unknown (never inventoried). Omit qty so cart add is allowed.
 * - Slot exists but never received a movement and qty is 0 → same as unknown.
 * - Slot exists with a movement history → report available qty (including 0 = out of stock).
 *
 * Missing inventory must not be coerced to "0". That made brand-new products
 * look out of stock and blocked add-to-cart / checkout-prep.
 */
export function resolvePosSearchStockAvailable(balance: {
  qtyAvailable?: string | null;
  lastMovementAt?: string | null;
} | null | undefined): string | undefined {
  if (!balance) return undefined;
  const qty = String(balance.qtyAvailable ?? "0");
  const neverMoved = !balance.lastMovementAt;
  if (neverMoved && compareDecimal(qty, "0") <= 0) return undefined;
  return qty;
}
