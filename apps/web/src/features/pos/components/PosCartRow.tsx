import { memo, useState, type KeyboardEvent } from "react";
import type { CartLine, LocaleMode } from "../pos-types";
import { moveCartQtyFocus, stockAvailabilityWarning } from "../pos-ux";
import {
  cartLineDisplayTotal,
  cartLineImageUrl,
  cartLineTitle,
} from "../pos-transaction";
import { POSIconButton, POSInput, POSSelect, POSTd } from "../design-system";

export type PosCartRowProps = {
  line: CartLine;
  index: number;
  locale: LocaleMode;
  onQty: (key: string, qty: string) => void;
  onIncrease: (key: string) => void;
  onDecrease: (key: string) => void;
  onPrice: (key: string, price: number) => void;
  onDiscount: (key: string, raw: string) => void;
  onUnitChange: (key: string, unitId: string) => void;
  onRemove: (key: string) => void;
  canDiscount: boolean;
  canPriceOverride: boolean;
};

export const PosCartRow = memo(function PosCartRow({
  line,
  index,
  locale,
  onQty,
  onIncrease,
  onDecrease,
  onPrice,
  onDiscount,
  onUnitChange,
  onRemove,
  canDiscount,
  canPriceOverride,
}: PosCartRowProps) {
  const name = cartLineTitle(line, locale);
  const unitOptions = line.unitOptions ?? [];
  const canEditRate = canPriceOverride || Boolean(line.isManual);
  const stockWarn = stockAvailabilityWarning(line.stock, line.qty);
  const photo = cartLineImageUrl(line);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photo) && !photoFailed;
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <tr className="pos-cart-row align-top hover:bg-[var(--pos-muted-bg)]/60">
      <POSTd className="pos-cart-optional">
        <span className="tabular-nums text-xs text-[var(--pos-muted)]">{index + 1}</span>
      </POSTd>
      <POSTd>
        <div className="flex min-w-0 items-start gap-2">
          <div className="pos-cart-row-photo" title={showPhoto ? name : undefined}>
            {showPhoto ? (
              <img
                src={photo ?? undefined}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span aria-hidden>{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="max-w-[9rem] font-medium leading-snug text-[var(--pos-ink)] sm:max-w-[12rem]">
              {name}
            </div>
            <div className="text-[11px] text-[var(--pos-muted)]">
              {line.sku ?? (line.isManual ? "Manual" : "—")}
              {line.stock != null ? ` · Stock ${line.stock}` : ""}
            </div>
            {stockWarn ? (
              <div className="text-[11px] text-[var(--pos-warning)]" role="status">
                {stockWarn}
              </div>
            ) : null}
          </div>
        </div>
      </POSTd>
      <POSTd>
        <div className="flex items-center gap-0.5">
          <POSIconButton
            className="h-7 w-7"
            label="Decrease quantity"
            onClick={() => onDecrease(line.key)}
          >
            −
          </POSIconButton>
          <POSInput
            className="w-12"
            value={line.qty}
            data-pos-cart-qty={index}
            onChange={(e) => {
              const next = e.target.value;
              if (next.startsWith("-")) return;
              onQty(line.key, next);
            }}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              moveCartQtyFocus(index, e.key === "ArrowDown" ? 1 : -1);
            }}
            aria-label={`Quantity for ${name}`}
            inputMode={(line.unitSymbolPlaces ?? 0) > 0 ? "decimal" : "numeric"}
          />
          <POSIconButton
            className="h-7 w-7"
            label="Increase quantity"
            onClick={() => onIncrease(line.key)}
          >
            +
          </POSIconButton>
        </div>
      </POSTd>
      <POSTd className="pos-cart-optional">
        {unitOptions.length > 1 ? (
          <POSSelect
            aria-label={`Unit for ${name}`}
            value={line.unitId}
            onChange={(e) => onUnitChange(line.key, e.target.value)}
            options={unitOptions.map((u) => ({
              value: u.unitId,
              label: u.unitName,
            }))}
          />
        ) : (
          <span className="text-xs text-[var(--pos-muted)]">{line.unitName ?? "—"}</span>
        )}
      </POSTd>
      <POSTd>
        {canEditRate ? (
          <POSInput
            className="w-20"
            type="number"
            value={String(line.unitPrice)}
            title="Unit price"
            data-pos-cart-rate=""
            onChange={(e) => onPrice(line.key, Number(e.target.value) || 0)}
            aria-label={`Rate for ${name}`}
          />
        ) : (
          <span className="tabular-nums text-xs" title="Price override requires manager approval (F4)">
            {line.unitPrice.toFixed(2)}
          </span>
        )}
      </POSTd>
      <POSTd>
        {canDiscount ? (
          <POSInput
            className="w-16"
            type="text"
            value={line.discountPercent ? `${line.discountPercent}%` : String(line.discount)}
            onChange={(e) => onDiscount(line.key, e.target.value)}
            aria-label={`Discount for ${name}`}
            title="Amount or 10%"
          />
        ) : (
          <span
            className="tabular-nums text-xs"
            title="Line discount requires a POS discount permission"
          >
            {line.discount.toFixed(2)}
          </span>
        )}
      </POSTd>
      <POSTd className="pos-cart-optional">
        <span className="tabular-nums text-xs text-[var(--pos-muted)]">{line.tax.toFixed(2)}</span>
      </POSTd>
      <POSTd className="text-right font-medium tabular-nums">{cartLineDisplayTotal(line).toFixed(2)}</POSTd>
      <POSTd>
        <POSIconButton label="Remove item" tone="danger" className="h-7 w-7" onClick={() => onRemove(line.key)}>
          ✕
        </POSIconButton>
      </POSTd>
    </tr>
  );
});
