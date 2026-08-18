import { memo } from "react";
import type { CartLine, LocaleMode } from "../pos-types";
import {
  POSButton,
  POSEmptyState,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTh,
} from "../design-system";
import { PosCartRow } from "./PosCartRow";

export type PosCartProps = {
  cart: CartLine[];
  locale: LocaleMode;
  onQty: (key: string, qty: string) => void;
  onIncrease: (key: string) => void;
  onDecrease: (key: string) => void;
  onPrice: (key: string, price: number) => void;
  onDiscount: (key: string, raw: string) => void;
  onUnitChange: (key: string, unitId: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onManual: () => void;
  canDiscount: boolean;
  canPriceOverride: boolean;
  cartError?: string | null;
};

export const PosCart = memo(function PosCart({
  cart,
  locale,
  onQty,
  onIncrease,
  onDecrease,
  onPrice,
  onDiscount,
  onUnitChange,
  onRemove,
  onClear,
  onManual,
  canDiscount,
  canPriceOverride,
  cartError,
}: PosCartProps) {
  return (
    <section className="pos-tx-cart flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--pos-ink)]">Cart ({cart.length})</h3>
        <div className="flex gap-1">
          <POSButton size="sm" variant="ghost" onClick={onManual} title="Add free-text line">
            Manual Entry
          </POSButton>
          <POSButton
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={!cart.length}
            title="Clear cart — confirmation required"
          >
            Clear Cart
          </POSButton>
        </div>
      </div>

      {cartError ? (
        <div
          role="alert"
          className="border-b border-[var(--pos-danger)]/30 bg-[var(--pos-danger-soft)] px-3 py-1.5 text-xs text-[var(--pos-danger)]"
        >
          {cartError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {cart.length === 0 ? (
          <POSEmptyState
            title="Cart is empty"
            description="Search or tap a product. The cart stays available while you browse."
          />
        ) : (
          <POSTable className="pos-cart-table">
            <POSTableHead>
              <tr>
                <POSTh className="pos-cart-optional">#</POSTh>
                <POSTh>Product</POSTh>
                <POSTh>Qty</POSTh>
                <POSTh className="pos-cart-optional">Unit</POSTh>
                <POSTh>Rate</POSTh>
                <POSTh>Discount</POSTh>
                <POSTh className="pos-cart-optional">Tax</POSTh>
                <POSTh className="text-right">Total</POSTh>
                <POSTh>{""}</POSTh>
              </tr>
            </POSTableHead>
            <POSTableBody>
              {cart.map((line, index) => (
                <PosCartRow
                  key={line.key}
                  line={line}
                  index={index}
                  locale={locale}
                  onQty={onQty}
                  onIncrease={onIncrease}
                  onDecrease={onDecrease}
                  onPrice={onPrice}
                  onDiscount={onDiscount}
                  onUnitChange={onUnitChange}
                  onRemove={onRemove}
                  canDiscount={canDiscount}
                  canPriceOverride={canPriceOverride}
                />
              ))}
            </POSTableBody>
          </POSTable>
        )}
      </div>
    </section>
  );
});
