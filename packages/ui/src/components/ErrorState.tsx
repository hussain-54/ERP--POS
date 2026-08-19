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
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-1 rounded-[var(--erp-radius)] border border-[var(--erp-danger-soft)] bg-[var(--erp-danger-soft)] px-4 py-8 text-center"
    >
      <h3 className="text-sm font-semibold text-[var(--erp-danger)]">{title}</h3>
      {description ? <p className="max-w-md text-sm text-[var(--erp-muted)]">{description}</p> : null}
      <div className="mt-2 flex gap-2">
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
