import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { SURFACE_CLASS } from "../lib/control.js";

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  divided?: boolean;
}

export function Card({
  title,
  description,
  icon,
  badge,
  actions,
  children,
  className,
  headerClassName,
  bodyClassName,
  divided = false,
}: CardProps) {
  const hasHeader = title || description || icon || badge || actions;

  return (
    <section className={cn(SURFACE_CLASS, "overflow-hidden", className)}>
      {hasHeader ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 p-3.5 sm:p-4",
            divided && "border-b border-[var(--erp-border)]",
            headerClassName,
          )}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {icon ? (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {title ? (
                  typeof title === "string" ? (
                    <h3 className="text-sm font-bold text-[var(--erp-ink)] tracking-tight truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )
                ) : null}
                {badge}
              </div>
              {description ? (
                typeof description === "string" ? (
                  <p className="mt-0.5 text-xs text-[var(--erp-muted)] leading-relaxed">{description}</p>
                ) : (
                  description
                )
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}

      <div className={cn(hasHeader ? (!divided ? "px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-0" : "p-3.5 sm:p-4") : "p-3.5 sm:p-4", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
