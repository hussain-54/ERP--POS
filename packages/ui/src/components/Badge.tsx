import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
}) {
  const tones = {
    neutral: "bg-[var(--erp-muted-bg)] text-[var(--erp-muted)]",
    success: "bg-[var(--erp-success-soft)] text-[var(--erp-success)]",
    warning: "bg-[var(--erp-warning-soft)] text-[var(--erp-warning)]",
    danger: "bg-[var(--erp-danger-soft)] text-[var(--erp-danger)]",
    brand: "bg-[var(--erp-brand-soft)] text-[var(--erp-brand)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--erp-radius-sm)] px-2 py-0.5 text-xs font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
