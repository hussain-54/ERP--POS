import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { posCn } from "./posCn";

export interface POSInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

export const POSInput = forwardRef<HTMLInputElement, POSInputProps>(function POSInput(
  { className, label, error, hint, id, leftAddon, rightAddon, disabled, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1 text-sm">
      {label ? <span className="font-medium text-[var(--pos-ink)]">{label}</span> : null}
      <span
        className={posCn(
          "pos-input-base flex items-center gap-2 !h-auto min-h-9 py-0",
          error && "border-[var(--pos-danger)]",
          disabled && "opacity-55",
        )}
      >
        {leftAddon ? <span className="text-[var(--pos-muted)]">{leftAddon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={posCn(
            "h-9 w-full min-w-0 border-0 bg-transparent px-0 text-sm outline-none focus:ring-0",
            className,
          )}
          {...props}
        />
        {rightAddon ? <span className="text-[var(--pos-muted)]">{rightAddon}</span> : null}
      </span>
      {error ? <span className="text-xs text-[var(--pos-danger)]">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-[var(--pos-muted)]">{hint}</span> : null}
    </label>
  );
});
