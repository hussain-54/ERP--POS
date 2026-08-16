import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

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
    <section
      className={cn(
        "rounded-2xl border border-[var(--erp-border)] bg-white p-4",
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title ? <h3 className="font-semibold">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-[var(--erp-muted)]">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
