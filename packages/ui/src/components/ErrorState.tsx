import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { cn } from "../lib/cn.js";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An error occurred while loading this section. Please try again or contact support if the issue persists.",
  onRetry,
  action,
  icon,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--erp-radius-lg)] border border-rose-200 bg-rose-50/40 p-6 sm:p-8 text-center shadow-xs",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-3">
        {icon || <i className="fa-solid fa-triangle-exclamation text-lg" />}
      </div>
      <h3 className="text-sm font-bold text-rose-950">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-rose-800/80 leading-relaxed">{description}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<i className="fa-solid fa-arrow-rotate-right text-[10px]" />}>
            Retry
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
