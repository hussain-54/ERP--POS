import type { CartLine } from "../pos-types";
import { lineTotal } from "../pos-types";
import {
  POSButton,
  POSCard,
  POSEmptyState,
  POSIconButton,
  POSInput,
  POSSelect,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "../design-system";

interface Props {
  cart: CartLine[];
  advanced: boolean;
  locale: "en" | "ur" | "en_ur";
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
}

export function PosCartPanel({
  cart,
  advanced,
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
}: Props) {
  return (
    <POSCard padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--pos-ink)]">Cart ({cart.length})</h3>
        <div className="flex gap-1">
          <POSButton size="sm" variant="ghost" onClick={onManual} title="Add free-text line">
            + Manual
          </POSButton>
          <POSButton
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={!cart.length}
            title="F7 Clear cart"
          >
            Clear
          </POSButton>
        </div>
      </div>

      {cartError ? (
        <div className="border-b border-[var(--pos-danger)]/30 bg-[var(--pos-danger-soft)] px-3 py-1.5 text-xs text-[var(--pos-danger)]">
          {cartError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {cart.length === 0 ? (
          <POSEmptyState title="Cart is empty" description="Add products from the grid" />
        ) : (
          <POSTable>
            <POSTableHead>
              <tr>
                <POSTh>Product</POSTh>
                <POSTh>Qty</POSTh>
                <POSTh>Unit</POSTh>
                <POSTh>Rate</POSTh>
                {(advanced || canDiscount) && <POSTh>Disc</POSTh>}
                <POSTh>Tax</POSTh>
                <POSTh className="text-right">Total</POSTh>
                <POSTh>{""}</POSTh>
              </tr>
            </POSTableHead>
            <POSTableBody>
              {cart.map((line) => {
                const name =
                  locale === "ur" && line.nameUr
                    ? line.nameUr
                    : locale === "en_ur" && line.nameUr
                      ? `${line.name} / ${line.nameUr}`
                      : line.name;
                const unitOptions = line.unitOptions ?? [];
                return (
                  <tr key={line.key} className="align-top hover:bg-[var(--pos-muted-bg)]/60">
                    <POSTd>
                      <div className="max-w-[9rem] font-medium leading-snug text-[var(--pos-ink)] sm:max-w-[12rem]">
                        {name}
                      </div>
                      <div className="text-[11px] text-[var(--pos-muted)]">
                        {line.sku ?? (line.isManual ? "Manual" : "")}
                        {line.stock != null ? ` · Stk ${line.stock}` : ""}
                      </div>
                    </POSTd>
                    <POSTd>
                      <div className="flex items-center gap-0.5">
                        <POSIconButton label="Decrease" onClick={() => onDecrease(line.key)}>
                          −
                        </POSIconButton>
                        <POSInput
                          className="w-14"
                          value={line.qty}
                          onChange={(e) => onQty(line.key, e.target.value)}
                          aria-label="Quantity"
                          inputMode={
                            (line.unitSymbolPlaces ?? 0) > 0 ? "decimal" : "numeric"
                          }
                        />
                        <POSIconButton label="Increase" onClick={() => onIncrease(line.key)}>
                          +
                        </POSIconButton>
                      </div>
                    </POSTd>
                    <POSTd>
                      {unitOptions.length > 1 ? (
                        <POSSelect
                          aria-label="Unit"
                          value={line.unitId}
                          onChange={(e) => onUnitChange(line.key, e.target.value)}
                          options={unitOptions.map((u) => ({
                            value: u.unitId,
                            label: u.unitName,
                          }))}
                        />
                      ) : (
                        <span className="text-xs text-[var(--pos-muted)]">
                          {line.unitName ?? "—"}
                        </span>
                      )}
                    </POSTd>
                    <POSTd>
                      {advanced ? (
                        <POSInput
                          className="w-20"
                          type="number"
                          value={String(line.unitPrice)}
                          title={
                            canPriceOverride || line.isManual
                              ? "Unit price"
                              : "Changing price requires manager approval"
                          }
                          onChange={(e) => onPrice(line.key, Number(e.target.value) || 0)}
                          aria-label="Unit price"
                        />
                      ) : (
                        <span className="tabular-nums text-xs">{line.unitPrice.toFixed(2)}</span>
                      )}
                    </POSTd>
                    {(advanced || canDiscount) && (
                      <POSTd>
                        {canDiscount ? (
                          <POSInput
                            className="w-16"
                            type="text"
                            value={
                              line.discountPercent
                                ? `${line.discountPercent}%`
                                : String(line.discount)
                            }
                            onChange={(e) => onDiscount(line.key, e.target.value)}
                            aria-label="Line discount amount or percent"
                            title="Amount or 10%"
                          />
                        ) : (
                          <span className="tabular-nums text-xs">{line.discount.toFixed(2)}</span>
                        )}
                      </POSTd>
                    )}
                    <POSTd>
                      <span className="tabular-nums text-xs text-[var(--pos-muted)]">
                        {line.tax.toFixed(2)}
                      </span>
                    </POSTd>
                    <POSTd className="text-right font-medium tabular-nums">
                      {lineTotal(line).toFixed(2)}
                    </POSTd>
                    <POSTd>
                      <POSIconButton
                        label="Remove line"
                        tone="danger"
                        onClick={() => onRemove(line.key)}
                      >
                        ✕
                      </POSIconButton>
                    </POSTd>
                  </tr>
                );
              })}
            </POSTableBody>
          </POSTable>
        )}
      </div>
    </POSCard>
  );
}
