import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

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
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium">{label}</span> : null}
      <select
        ref={ref}
        className={cn(
          "h-10 rounded-xl border border-[var(--erp-border)] bg-white px-3 outline-none focus:ring-2 focus:ring-[var(--erp-ring)]",
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[var(--erp-danger)]">{error}</span> : null}
    </label>
  );
});
