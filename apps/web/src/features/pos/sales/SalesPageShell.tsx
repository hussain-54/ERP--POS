import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function SalesPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--pos-workspace)]">
      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4">
        <Link to="/pos" className="pos-back-link mb-2 w-fit shrink-0">
          <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
          Back to POS Command Center
        </Link>
        <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pos-primary)]">
              02 · Sales
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
