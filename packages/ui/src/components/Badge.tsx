import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "brand"
  | "info"
  | "purple"
  | "cyan"
  | "amber";

export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
  warning: "bg-amber-50 text-amber-800 border-amber-200/80",
  danger: "bg-rose-50 text-rose-800 border-rose-200/80",
  brand: "bg-blue-50 text-blue-700 border-blue-200/80",
  info: "bg-sky-50 text-sky-800 border-sky-200/80",
  purple: "bg-purple-50 text-purple-800 border-purple-200/80",
  cyan: "bg-cyan-50 text-cyan-800 border-cyan-200/80",
  amber: "bg-amber-50 text-amber-800 border-amber-200/80",
};

const dotStyles: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  brand: "bg-blue-600",
  info: "bg-sky-500",
  purple: "bg-purple-600",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
};

export function Badge({
  children,
  tone = "neutral",
  size = "md",
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--erp-radius-sm)] border font-medium tracking-tight",
        size === "sm" ? "px-1.5 py-0.5 text-[10px] leading-none" : "px-2 py-0.5 text-xs",
        toneStyles[tone],
        className,
      )}
    >
      {dot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotStyles[tone])} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
