import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-[var(--erp-muted)]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}:${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <span aria-hidden>›</span> : null}
              {item.href && !last ? (
                <a className="truncate hover:text-[var(--erp-ink)]" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span
                  className={cn("truncate", last && "font-medium text-[var(--erp-ink)]")}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageToolbar({
  title,
  description,
  actions,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (!title && !actions) return null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {title ? <h2 className="text-base font-semibold text-[var(--erp-ink)]">{title}</h2> : null}
        {description ? <p className="mt-0.5 text-sm text-[var(--erp-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
