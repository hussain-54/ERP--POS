import type { SelectHTMLAttributes } from "react";
import { posCn } from "./posCn";

export interface POSSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface POSSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  compact?: boolean;
  options: POSSelectOption[];
}

export function POSSelect({
  className,
  label,
  error,
  options,
  id,
  disabled,
  compact,
  ...props
}: POSSelectProps) {
  const selectId = id ?? props.name;
  return (
    <label className={posCn("flex w-full flex-col", compact ? "gap-0.5" : "gap-1 text-sm")}>
      {label ? (
        <span className={posCn("pos-field-label", compact && "pos-field-label--compact")}>
          {label}
        </span>
      ) : null}
      <select
        id={selectId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={posCn("pos-input-base", compact && "h-8 text-xs", error && "border-[var(--pos-danger)]", className)}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-[var(--pos-danger)]">{error}</span> : null}
    </label>
  );
}
