import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { SURFACE_CLASS } from "../lib/control.js";

export function Card({
  title,
  description,
  children,
  className,
  actions,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn(SURFACE_CLASS, "p-3 md:p-4", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-semibold text-[var(--erp-ink)]">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-sm text-[var(--erp-muted)]">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
