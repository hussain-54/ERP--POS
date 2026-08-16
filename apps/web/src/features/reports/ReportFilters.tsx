import { Input } from "@electronic-erp/ui";
import type { ReportFilterInput } from "./reporting-api";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
] as const;

export function ReportFilters(props: {
  value: ReportFilterInput;
  onChange: (next: ReportFilterInput) => void;
}) {
  const { value, onChange } = props;
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-[var(--erp-ink)]">Period</span>
        <select
          className="h-10 rounded-xl border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] outline-none focus:ring-2 focus:ring-[var(--erp-ring)]"
          value={value.period ?? "month"}
          onChange={(e) => onChange({ ...value, period: e.target.value })}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <Input
        label="From"
        type="date"
        value={value.from ?? ""}
        onChange={(e) => onChange({ ...value, from: e.target.value, period: "custom" })}
      />
      <Input
        label="To"
        type="date"
        value={value.to ?? ""}
        onChange={(e) => onChange({ ...value, to: e.target.value, period: "custom" })}
      />
      <Input
        label="Branch id"
        value={value.branchId ?? ""}
        onChange={(e) => onChange({ ...value, branchId: e.target.value || undefined })}
      />
      <Input
        label="Warehouse id"
        value={value.warehouseId ?? ""}
        onChange={(e) => onChange({ ...value, warehouseId: e.target.value || undefined })}
      />
      <Input
        label="Salesman id"
        value={value.salesmanUserId ?? ""}
        onChange={(e) => onChange({ ...value, salesmanUserId: e.target.value || undefined })}
      />
      <Input
        label="Category id"
        value={value.categoryId ?? ""}
        onChange={(e) => onChange({ ...value, categoryId: e.target.value || undefined })}
      />
      <Input
        label="Brand id"
        value={value.brandId ?? ""}
        onChange={(e) => onChange({ ...value, brandId: e.target.value || undefined })}
      />
    </div>
  );
}
