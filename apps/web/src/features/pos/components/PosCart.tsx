import { memo, type RefObject } from "react";
import type { CartLine, LocaleMode } from "../pos-types";
import { cartEmptyCopy } from "../pos-user-messages";
import {
  POSButton,
  POSEmptyState,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTh,
} from "../design-system";
import { PosCartRow } from "./PosCartRow";
import {
  PosInvoiceDiscountField,
  type InvoiceDiscountMode,
} from "./PosInvoiceDiscountField";

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
  onManual?: () => void;
  canDiscount: boolean;
  canPriceOverride: boolean;
  cartError?: string | null;
  invoiceDiscount?: string;
  invoiceDiscountKind?: InvoiceDiscountMode;
  invoiceDiscountPercent?: number;
  onInvoiceDiscount?: (value: string) => void;
  discountRef?: RefObject<HTMLInputElement | null>;
  canInvoiceDiscount?: boolean;
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
  canDiscount,
  canPriceOverride,
  cartError,
  invoiceDiscount = "",
  invoiceDiscountKind = "fixed",
  invoiceDiscountPercent = 0,
  onInvoiceDiscount,
  discountRef,
  canInvoiceDiscount = false,
}: PosCartProps) {
  const itemLabel = cart.length === 1 ? "ITEM" : "ITEMS";

  return (
    <section className="pos-tx-cart flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pos-cart-header flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pos-border)] px-3 py-2">
        <h3 className="pos-cart-title text-[var(--pos-ink)]">
          Cart · {cart.length} {itemLabel.toLowerCase()}
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <PosInvoiceDiscountField
            appliedAmount={invoiceDiscount}
            kind={invoiceDiscountKind}
            percent={invoiceDiscountPercent}
            canDiscount={canInvoiceDiscount}
            discountRef={discountRef}
            onApply={(raw) => onInvoiceDiscount?.(raw)}
          />
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
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-6 py-10 text-center">
            <POSEmptyState
              title={cartEmptyCopy().title}
              description={cartEmptyCopy().description}
            />
          </div>
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
