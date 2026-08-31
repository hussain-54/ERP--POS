import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "warning" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--erp-brand)] text-[var(--erp-on-brand)] shadow-xs hover:bg-[var(--erp-brand-hover)] active:bg-[var(--erp-brand-active)]",
  secondary:
    "bg-[var(--erp-surface)] text-[var(--erp-ink)] border border-[var(--erp-border)] shadow-xs hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100",
  outline:
    "bg-transparent text-[var(--erp-brand)] border border-[var(--erp-brand)] hover:bg-[var(--erp-brand-soft)] active:bg-blue-100",
  ghost:
    "bg-transparent text-[var(--erp-ink)] hover:bg-slate-100 active:bg-slate-200",
  danger:
    "bg-[var(--erp-danger)] text-white shadow-xs hover:bg-red-700 active:bg-red-800",
  warning:
    "bg-[var(--erp-warning)] text-white shadow-xs hover:bg-amber-700 active:bg-amber-800",
  success:
    "bg-[var(--erp-success)] text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-[11px] font-semibold gap-1 rounded-[var(--erp-radius-sm)]",
  sm: "h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-[var(--erp-radius)]",
  md: "h-9 px-3.5 text-xs sm:text-sm font-semibold gap-2 rounded-[var(--erp-radius)]",
  lg: "h-10 px-4 text-sm font-bold gap-2 rounded-[var(--erp-radius)]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  rightIcon,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-all select-none [touch-action:manipulation]",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        leftIcon
      )}
      {loading && !children ? "Loading…" : children}
      {!loading && rightIcon ? rightIcon : null}
    </button>
  );
}
