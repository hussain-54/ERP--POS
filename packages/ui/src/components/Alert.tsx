import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export type AlertTone = "info" | "success" | "warning" | "danger";

export interface AlertProps {
  title?: string;
  children: ReactNode;
  tone?: AlertTone;
  icon?: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}

const toneStyles: Record<AlertTone, { wrapper: string; title: string; icon: string; border: string }> = {
  info: {
    wrapper: "bg-blue-50/80 text-blue-900 border-blue-200",
    title: "text-blue-950 font-bold",
    icon: "text-blue-600",
    border: "border-blue-500",
  },
  success: {
    wrapper: "bg-emerald-50/80 text-emerald-900 border-emerald-200",
    title: "text-emerald-950 font-bold",
    icon: "text-emerald-600",
    border: "border-emerald-500",
  },
  warning: {
    wrapper: "bg-amber-50/80 text-amber-900 border-amber-200",
    title: "text-amber-950 font-bold",
    icon: "text-amber-600",
    border: "border-amber-500",
  },
  danger: {
    wrapper: "bg-red-50/80 text-red-900 border-red-200",
    title: "text-red-950 font-bold",
    icon: "text-red-600",
    border: "border-red-500",
  },
};

export function Alert({
  title,
  children,
  tone = "info",
  icon,
  action,
  onClose,
  className,
}: AlertProps) {
  const current = toneStyles[tone];

  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-3.5 text-xs sm:text-sm transition-all",
        current.wrapper,
        className,
      )}
    >
      {icon ? (
        <span className={cn("mt-0.5 shrink-0 text-base sm:text-lg", current.icon)}>{icon}</span>
      ) : null}

      <div className="min-w-0 flex-1">
        {title ? <h4 className={cn("text-xs font-black uppercase tracking-wide", current.title)}>{title}</h4> : null}
        <div className={cn("leading-relaxed", title && "mt-1 text-xs opacity-90")}>{children}</div>
        {action ? <div className="mt-2.5 flex items-center gap-2">{action}</div> : null}
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700 transition"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
