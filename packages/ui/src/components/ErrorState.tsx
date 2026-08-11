import type { ReactNode } from "react";
import { Button } from "./Button.js";

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  action,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--erp-danger)]/30 bg-[#fff8f7] px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-[var(--erp-danger)]">{title}</h3>
      {description ? <p className="max-w-md text-sm text-[var(--erp-muted)]">{description}</p> : null}
      <div className="mt-2 flex gap-2">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
