import { cn } from "../lib/cn.js";

export interface LoadingStateProps {
  label?: string;
  variant?: "spinner" | "skeleton" | "table";
  rows?: number;
  className?: string;
}

export function LoadingState({
  label = "Loading data…",
  variant = "spinner",
  rows = 4,
  className,
}: LoadingStateProps) {
  if (variant === "table") {
    return (
      <div
        role="status"
        className={cn(
          "w-full overflow-hidden rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-white p-4 space-y-3",
          className,
        )}
      >
        <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200 mb-4" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-1">
            <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
            <div className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div
        role="status"
        className={cn("w-full space-y-2.5 p-4 rounded-[var(--erp-radius)] border border-slate-200 bg-white", className)}
      >
        <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-center gap-3 rounded-[var(--erp-radius)] border border-slate-200 bg-white px-4 py-8 text-xs font-semibold text-slate-500 shadow-xs",
        className,
      )}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
      <span>{label}</span>
    </div>
  );
}
