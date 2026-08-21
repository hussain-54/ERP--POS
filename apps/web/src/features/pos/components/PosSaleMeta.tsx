import { memo, useMemo } from "react";
import { POSBadge, POSSelect } from "../design-system";
import type { LocaleMode, PosMode } from "../pos-types";

export const PosSaleMeta = memo(function PosSaleMeta({
  warehouseId,
  warehouses,
  lastInvoice,
  mode,
  locale,
  onWarehouse,
  onMode,
  onLocale,
}: {
  warehouseId: string;
  warehouses: Array<{ id: string; name: string }>;
  lastInvoice: string | null;
  mode: PosMode;
  locale: LocaleMode;
  onWarehouse: (id: string) => void;
  onMode: (mode: PosMode) => void;
  onLocale: (locale: LocaleMode) => void;
}) {
  const warehouseOptions = useMemo(
    () =>
      warehouses.length
        ? warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))
        : [{ value: "", label: "No warehouse" }],
    [warehouses],
  );

  return (
    <div className="pos-sale-meta" aria-label="Sale settings">
      <div className="w-[8.5rem]">
        <POSSelect
          compact
          aria-label="Warehouse"
          value={warehouseId}
          onChange={(event) => onWarehouse(event.target.value)}
          options={warehouseOptions}
        />
      </div>
      {!warehouseId ? <POSBadge tone="warning">No warehouse</POSBadge> : null}
      {lastInvoice ? <POSBadge tone="success">Last {lastInvoice}</POSBadge> : null}
      {mode === "easy" ? <POSBadge tone="primary">Quick Sale</POSBadge> : null}
      <div className="w-[5.5rem]">
        <POSSelect
          compact
          aria-label="Mode"
          value={mode}
          onChange={(event) => onMode(event.target.value as PosMode)}
          options={[
            { value: "easy", label: "Easy" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
      </div>
      <div className="w-[5.5rem]">
        <POSSelect
          compact
          aria-label="Language"
          value={locale}
          onChange={(event) => onLocale(event.target.value as LocaleMode)}
          options={[
            { value: "en", label: "EN" },
            { value: "ur", label: "UR" },
            { value: "en_ur", label: "EN+UR" },
          ]}
        />
      </div>
    </div>
  );
});
