import { Button, Card, Input } from "@electronic-erp/ui";
import type { CartLine } from "../pos-types";
import { lineTotal } from "../pos-types";
import { POSEmptyState } from "../design-system";

interface Props {
  cart: CartLine[];
  advanced: boolean;
  locale: "en" | "ur" | "en_ur";
  onQty: (key: string, qty: string) => void;
  onPrice: (key: string, price: number) => void;
  onDiscount: (key: string, discount: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onManual: () => void;
  canDiscount: boolean;
  canPriceOverride: boolean;
}

export function PosCartPanel({
  cart,
  advanced,
  locale,
  onQty,
  onPrice,
  onDiscount,
  onRemove,
  onClear,
  onManual,
  canDiscount,
  canPriceOverride,
}: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col border-[var(--pos-border)] bg-[var(--pos-card)] p-0 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-3 py-2">
        <h3 className="text-sm font-semibold">Cart ({cart.length})</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={onManual} title="Add free-text line">
            + Manual
          </Button>
          <Button size="sm" variant="secondary" onClick={onClear} disabled={!cart.length} title="F7 Clear cart">
            Clear
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {cart.length === 0 ? (
          <POSEmptyState
            title="Cart is empty"
            description="Add products from the grid"
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-[var(--pos-muted)]">
              <tr>
                <th className="px-2 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Qty</th>
                {advanced ? <th className="px-2 py-2 font-medium">Price</th> : null}
                {advanced && canDiscount ? <th className="px-2 py-2 font-medium">Disc</th> : null}
                <th className="px-2 py-2 font-medium text-right">Total</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {cart.map((line) => {
                const name =
                  locale === "ur" && line.nameUr
                    ? line.nameUr
                    : locale === "en_ur" && line.nameUr
                      ? `${line.name} / ${line.nameUr}`
                      : line.name;
                return (
                  <tr key={line.key} className="border-t border-[var(--pos-border)] align-top">
                    <td className="px-2 py-2">
                      <div className="font-medium leading-snug">{name}</div>
                      <div className="text-[11px] text-[var(--pos-muted)]">
                        {line.sku ?? (line.isManual ? "Manual" : "")}
                        {line.stock != null ? ` · Stock ${line.stock}` : ""}
                      </div>
                      {!advanced ? (
                        <div className="text-[11px] text-[var(--pos-muted)]">@ {line.unitPrice.toFixed(2)}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className="w-16"
                        value={line.qty}
                        onChange={(e) => onQty(line.key, e.target.value)}
                        aria-label="Quantity"
                      />
                    </td>
                    {advanced ? (
                      <td className="px-2 py-2">
                        <Input
                          className="w-20"
                          type="number"
                          value={String(line.unitPrice)}
                          disabled={false}
                          title={
                            canPriceOverride || line.isManual
                              ? "Unit price"
                              : "Changing price requires manager approval"
                          }
                          onChange={(e) => onPrice(line.key, Number(e.target.value) || 0)}
                          aria-label="Unit price"
                        />
                      </td>
                    ) : null}
                    {advanced && canDiscount ? (
                      <td className="px-2 py-2">
                        <Input
                          className="w-16"
                          type="number"
                          value={String(line.discount)}
                          onChange={(e) => onDiscount(line.key, Number(e.target.value) || 0)}
                          aria-label="Line discount"
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{lineTotal(line).toFixed(2)}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-[var(--pos-danger)] text-xs"
                        onClick={() => onRemove(line.key)}
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
