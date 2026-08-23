import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function PosSubPageShell({
  moduleNumber,
  moduleLabel,
  title,
  description,
  actions,
  children,
}: {
  moduleNumber: string;
  moduleLabel: string;
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
              {moduleNumber} · {moduleLabel}
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

export function PosComingSoonPanel({
  title,
  reason,
}: {
  title: string;
  reason: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
        Coming soon
      </span>
      <h2 className="mt-3 text-base font-bold text-slate-800">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">{reason}</p>
    </div>
  );
}
