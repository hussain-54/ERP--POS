import type { ButtonHTMLAttributes, ReactNode } from "react";
import { posCn } from "./posCn";

export interface POSIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  loading?: boolean;
  tone?: "default" | "primary" | "danger" | "onNavy";
  children: ReactNode;
}

const tones = {
  default: "text-[var(--pos-ink)] hover:bg-[var(--pos-muted-bg)]",
  primary: "text-[var(--pos-primary)] hover:bg-[var(--pos-primary-soft)]",
  danger: "text-[var(--pos-danger)] hover:bg-[var(--pos-danger-soft)]",
  onNavy: "text-[var(--pos-on-navy)] hover:bg-white/10",
};

export function POSIconButton({
  label,
  loading,
  tone = "default",
  className,
  children,
  disabled,
  type = "button",
  ...props
}: POSIconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={posCn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[var(--pos-radius-sm)] text-sm",
        "focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)] disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}
