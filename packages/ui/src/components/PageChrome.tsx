import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface PageHeaderProps {
  moduleNumber?: string;
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  moduleNumber,
  icon,
  eyebrow,
  title,
  description,
  badge,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("erp-page-toolbar flex flex-col gap-2.5 pb-1", className)}>
      {breadcrumb ? <div className="text-xs text-[var(--erp-muted)]">{breadcrumb}</div> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {moduleNumber ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-black shadow-xs">
              {moduleNumber}
            </span>
          ) : icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-sm shadow-xs">
              {icon}
            </span>
          ) : null}

          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--erp-muted)]">{eyebrow}</p>
            ) : null}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight text-[var(--erp-ink)] sm:text-xl md:text-2xl">
                {title}
              </h1>
              {badge}
            </div>
            {description ? (
              <p className="mt-0.5 max-w-3xl text-xs sm:text-sm leading-relaxed text-[var(--erp-muted)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  tone?: "neutral" | "success" | "warning" | "danger" | "brand" | "purple";
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  delta,
  deltaTone = "positive",
  tone = "neutral",
  onClick,
  className,
}: KpiCardProps) {
  const accents = {
    neutral: "border-slate-200 bg-white hover:border-slate-300",
    success: "border-emerald-200/90 bg-emerald-50/30 hover:border-emerald-300",
    warning: "border-amber-200/90 bg-amber-50/30 hover:border-amber-300",
    danger: "border-rose-200/90 bg-rose-50/30 hover:border-rose-300",
    brand: "border-blue-200/90 bg-blue-50/30 hover:border-blue-300",
    purple: "border-purple-200/90 bg-purple-50/30 hover:border-purple-300",
  };

  const iconWrappers = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    brand: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  };

  const deltaStyles = {
    positive: "text-emerald-700 bg-emerald-50 border-emerald-200",
    negative: "text-rose-700 bg-rose-50 border-rose-200",
    neutral: "text-slate-600 bg-slate-50 border-slate-200",
  };

  const RootTag = onClick ? "button" : "article";

  return (
    <RootTag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col justify-between rounded-[var(--erp-radius-lg)] border p-3.5 sm:p-4 text-left shadow-xs transition-all",
        accents[tone],
        onClick && "cursor-pointer active:scale-[0.99] hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 line-clamp-1">{label}</p>
        {icon ? (
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs", iconWrappers[tone])}>
            {icon}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-xl font-black tabular-nums tracking-tight text-[var(--erp-ink)] sm:text-2xl">
          {value}
        </div>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold border",
              deltaStyles[deltaTone],
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-[11px] text-[var(--erp-muted)] line-clamp-1">{hint}</p> : null}
    </RootTag>
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
            {title ? <h2 className="text-sm font-bold text-[var(--erp-ink)]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-[var(--erp-muted)]">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
