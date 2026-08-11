import type { ReactNode } from "react";
import { posCn } from "./posCn";

export function POSCard({
  title,
  description,
  children,
  className,
  actions,
  padding = "md",
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
  padding?: "none" | "sm" | "md";
}) {
  const pad = padding === "none" ? "p-0" : padding === "sm" ? "p-3" : "p-4";
  return (
    <section className={posCn("pos-surface overflow-hidden", pad, className)}>
      {(title || actions) && (
        <div className={posCn("mb-3 flex items-start justify-between gap-3", padding === "none" && "px-4 pt-4")}>
          <div>
            {title ? <h3 className="text-sm font-semibold text-[var(--pos-ink)]">{title}</h3> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--pos-muted)]">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
