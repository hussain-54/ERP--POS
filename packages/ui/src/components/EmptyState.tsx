import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--erp-radius-lg)] border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-xs",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-3 shadow-inner">
        {icon || <i className="fa-solid fa-inbox text-xl" />}
      </div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
