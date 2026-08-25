import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("erp-page-toolbar flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">{eyebrow}</p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-[var(--erp-ink)] sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--erp-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
}) {
  const accents = {
    neutral: "border-[var(--erp-border)]",
    success: "border-[var(--erp-success)]/25",
    warning: "border-[var(--erp-warning)]/25",
    danger: "border-[var(--erp-danger)]/25",
    brand: "border-[var(--erp-brand)]/25",
  };
  return (
    <article
      className={cn(
        "rounded-[var(--erp-radius-lg)] border bg-[var(--erp-surface)] p-3 shadow-[var(--erp-shadow)] sm:p-4",
        accents[tone],
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[var(--erp-ink)] sm:text-2xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--erp-muted)]">{hint}</p> : null}
    </article>
  );
}

export function SectionBlock({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-[var(--erp-ink)]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-[var(--erp-muted)]">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
