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
    neutral: "bg-[var(--erp-bg)] text-[var(--erp-muted)]",
    success: "bg-[#e8f8ef] text-[var(--erp-success)]",
    warning: "bg-[#fff4e5] text-[var(--erp-warning)]",
    danger: "bg-[#fdecea] text-[var(--erp-danger)]",
    brand: "bg-[#e7f5f2] text-[var(--erp-brand)]",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
