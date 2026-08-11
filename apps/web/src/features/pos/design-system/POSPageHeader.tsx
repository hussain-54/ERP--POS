import type { ReactNode } from "react";
import { posCn } from "./posCn";

export function POSPageHeader({
  title,
  subtitle,
  actions,
  meta,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={posCn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-[var(--pos-ink)]">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--pos-muted)]">{subtitle}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
