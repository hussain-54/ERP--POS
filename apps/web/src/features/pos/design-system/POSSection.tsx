import type { ReactNode } from "react";
import { posCn } from "./posCn";

/** Compact section heading + body. Use inside POSCard or the page column. */
export function POSSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={posCn("min-w-0", className)}>
      {title || actions ? (
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[length:var(--pos-text-md)] font-semibold tracking-tight text-[var(--pos-ink)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--pos-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
