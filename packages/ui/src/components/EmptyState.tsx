import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-[var(--erp-radius-lg)] border border-dashed border-[var(--erp-border)] bg-[var(--erp-surface)] px-4 py-10 text-center">
      <h3 className="text-sm font-semibold text-[var(--erp-ink)]">{title}</h3>
      {description ? <p className="max-w-md text-sm leading-relaxed text-[var(--erp-muted)]">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
