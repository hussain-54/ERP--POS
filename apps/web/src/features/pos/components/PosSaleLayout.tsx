import type { ReactNode } from "react";
import { POSButton, POSDrawer } from "../design-system";
import { posSaleLayoutClass, type PosMobileSheet, type PosSaleChrome } from "../pos-layout";

export function PosSaleLayout({
  chrome,
  product,
  customer,
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
    <div className="pos-sale-ops flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
      <div className="pos-sale-ops-customer min-h-0 shrink-0 overflow-auto">{customer}</div>
      {cart}
      <div className="shrink-0">{payment}</div>
    </div>
  );

  if (chrome === "sheets") {
    return (
      <div className={`${posSaleLayoutClass(chrome)} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pb-0">{product}</div>
        <div className="pos-mobile-dock" role="navigation" aria-label="Mobile POS actions">
          <POSButton
            variant="secondary"
            onClick={() => onMobileSheet("cart")}
            title="Open cart"
          >
            <span className="flex min-w-0 flex-col leading-tight">
              <span>Cart ({cartCount})</span>
              <span className="text-[10px] font-normal tabular-nums">Rs {grandTotal.toFixed(2)}</span>
            </span>
          </POSButton>
          <POSButton
            variant="secondary"
            onClick={() => onMobileSheet("customer")}
            title="Open customer"
          >
            {customerLabel}
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
    <div className={`${posSaleLayoutClass(chrome)} min-h-0 min-w-0 gap-3 overflow-hidden p-3`}>
      {product}
      {ops}
    </div>
  );
}
