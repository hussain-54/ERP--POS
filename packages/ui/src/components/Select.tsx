import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";
import { CONTROL_CLASS } from "../lib/control.js";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, error, options, placeholder, ...props },
  ref,
) {
  return (
    <label className="flex w-full flex-col gap-1 text-sm">
      {label ? <span className="font-medium text-[var(--erp-ink)]">{label}</span> : null}
      <select ref={ref} className={cn(CONTROL_CLASS, className)} {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-[var(--erp-danger)]">{error}</span> : null}
    </label>
  );
});
