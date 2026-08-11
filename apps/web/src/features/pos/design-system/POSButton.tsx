import type { ButtonHTMLAttributes, ReactNode } from "react";
import { posCn } from "./posCn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md" | "lg";

export interface POSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--pos-primary)] text-white hover:bg-[var(--pos-primary-strong)] active:brightness-95",
  secondary:
    "bg-[var(--pos-secondary-soft)] text-[var(--pos-secondary)] border border-[var(--pos-secondary)]/20 hover:bg-[var(--pos-secondary)]/10",
  ghost: "bg-transparent text-[var(--pos-ink)] hover:bg-[var(--pos-muted-bg)]",
  danger: "bg-[var(--pos-danger)] text-white hover:brightness-95",
  success: "bg-[var(--pos-success)] text-white hover:brightness-95",
  warning: "bg-[var(--pos-warning)] text-white hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3 text-sm gap-2",
  lg: "h-11 px-4 text-sm gap-2",
};

export function POSButton({
  className,
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  children,
  disabled,
  type = "button",
  ...props
}: POSButtonProps) {
  return (
    <button
      type={type}
      className={posCn(
        "inline-flex items-center justify-center rounded-[var(--pos-radius-sm)] font-medium transition",
        "focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        leftIcon
      )}
      {loading ? "Loading…" : children}
    </button>
  );
}
