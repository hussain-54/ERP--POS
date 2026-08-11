import { Input } from "./Input.js";

export function CurrencyInput({
  label,
  value,
  onChange,
  currency = "PKR",
  error,
  name,
}: {
  label?: string;
  value: number | "";
  onChange: (value: number | "") => void;
  currency?: string;
  error?: string;
  name?: string;
}) {
  return (
    <div className="relative">
      <Input
        label={label}
        name={name}
        inputMode="decimal"
        error={error}
        value={value === "" ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0) return;
          onChange(Math.round(n * 100) / 100);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-[2.15rem] text-xs text-[var(--erp-muted)]">
        {currency}
      </span>
    </div>
  );
}
