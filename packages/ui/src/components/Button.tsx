import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-[var(--erp-brand)] text-white hover:bg-[var(--erp-brand-strong)]",
  secondary: "bg-white text-[var(--erp-ink)] border border-[var(--erp-border)] hover:bg-[var(--erp-bg)]",
  ghost: "bg-transparent text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]",
  danger: "bg-[var(--erp-danger)] text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {leftIcon}
      {loading ? "Loading…" : children}
    </button>
  );
}
