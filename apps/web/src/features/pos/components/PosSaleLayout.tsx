import type { ReactNode } from "react";
import { POSButton, POSDrawer } from "../design-system";
import { posSaleLayoutClass, type PosMobileSheet, type PosSaleChrome } from "../pos-layout";

/**
 * Terminal sale chrome:
 * - Desktop / wide tablet: product discovery | cart + sticky payment
 * - Portrait tablet: stacked zones still in viewport
 * - Mobile: products → cart sheet → payment sheet
 */
export function PosSaleLayout({
  chrome,
  product,
  customer,
  quickActions,
  cart,
  payment,
  cartCount,
  grandTotal,
  customerLabel,
  canPay,
  payBlockedReason,
  mobileSheet,
  onMobileSheet,
  onCancelSale,
}: {
  chrome: PosSaleChrome;
  product: ReactNode;
  customer: ReactNode;
  quickActions?: ReactNode;
  cart: ReactNode;
  payment: ReactNode;
  cartCount: number;
  grandTotal: number;
  customerLabel: string;
  canPay: boolean;
  payBlockedReason?: string | null;
  mobileSheet: PosMobileSheet;
  onMobileSheet: (sheet: PosMobileSheet) => void;
  onCancelSale: () => void;
}) {
  const ops = (
    <aside className="pos-sale-ops flex min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Current sale">
      <div className="pos-sale-ops-customer shrink-0 overflow-y-auto border-b border-[var(--pos-border)] bg-[var(--pos-workspace)]">
        {customer}
      </div>
      {quickActions ? (
        <div className="pos-sale-ops-quick shrink-0 border-b border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-2">
          {quickActions}
        </div>
      ) : null}
      <div className="pos-sale-ops-cart flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--pos-workspace)]">
        {cart}
      </div>
      <div className="pos-sale-ops-pay shrink-0 overflow-y-auto border-t border-[var(--pos-border)] bg-[var(--pos-workspace)]">
        {payment}
      </div>
    </aside>
  );

  if (chrome === "sheets") {
    return (
      <div className={`${posSaleLayoutClass(chrome)} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pb-0">{product}</div>
        <div className="pos-mobile-dock" role="navigation" aria-label="Mobile POS actions">
          <POSButton
            variant="secondary"
            className="min-w-0"
            onClick={() => onMobileSheet("cart")}
            title="Open cart"
          >
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate">Cart ({cartCount})</span>
              <span className="truncate text-[10px] font-normal tabular-nums">Rs {grandTotal.toFixed(2)}</span>
            </span>
          </POSButton>
          <POSButton
            variant="secondary"
            className="min-w-0"
            onClick={() => onMobileSheet("customer")}
            title={customerLabel}
          >
            <span className="truncate">{customerLabel}</span>
          </POSButton>
          <POSButton
            variant="success"
            className="min-w-0"
            onClick={() => onMobileSheet("pay")}
            disabled={!canPay}
            title={payBlockedReason ?? "Open payment"}
          >
            Pay
          </POSButton>
        </div>
        <POSDrawer
          open={mobileSheet === "cart"}
          title={`Cart (${cartCount})`}
          onClose={() => onMobileSheet(null)}
          side="right"
          size="full"
          padded={false}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <POSButton variant="danger" onClick={onCancelSale}>
                Cancel sale
              </POSButton>
              <POSButton
                variant="success"
                onClick={() => onMobileSheet("pay")}
                disabled={!canPay}
                title={payBlockedReason ?? "Open payment"}
              >
                Pay
              </POSButton>
            </div>
          }
        >
          {quickActions ? <div className="border-b border-[var(--pos-border)] px-3 py-2">{quickActions}</div> : null}
          {cart}
        </POSDrawer>
        <POSDrawer
          open={mobileSheet === "customer"}
          title="Customer"
          onClose={() => onMobileSheet(null)}
          side="right"
          size="full"
        >
          {customer}
        </POSDrawer>
        <POSDrawer
          open={mobileSheet === "pay"}
          title="Payment"
          onClose={() => onMobileSheet(null)}
          side="bottom"
          size="full"
          padded={false}
        >
          <div className="p-3">{payment}</div>
        </POSDrawer>
        <div className="sr-only">Grand total Rs {grandTotal.toFixed(2)}</div>
      </div>
    );
  }

  return (
    <div
      className={`${posSaleLayoutClass(chrome)} min-h-0 min-w-0 overflow-hidden bg-[var(--pos-bg)]`}
      data-pos-chrome={chrome}
    >
      <div className="pos-sale-products min-h-0 min-w-0 overflow-hidden border-r border-[var(--pos-border)] bg-[var(--pos-discovery-bg)]">
        {product}
      </div>
      {ops}
    </div>
  );
}
