import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? <span className="font-medium text-[var(--erp-ink)]">{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "h-10 rounded-xl border border-[var(--erp-border)] bg-white px-3 text-[var(--erp-ink)] outline-none focus:ring-2 focus:ring-[var(--erp-ring)]",
          error && "border-[var(--erp-danger)]",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-[var(--erp-danger)]">{error}</span> : null}
      {!error && hint ? <span className="text-[var(--erp-muted)]">{hint}</span> : null}
    </label>
  );
});
