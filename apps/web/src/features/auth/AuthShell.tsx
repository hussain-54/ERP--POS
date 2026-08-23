import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="erp-auth-shell min-h-screen w-full overflow-x-hidden">
      <div className="erp-auth-shell-inner mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <aside className="erp-auth-brand relative hidden flex-col justify-between overflow-hidden px-10 py-12 text-white lg:flex">
          <div className="relative z-10">
            <Link to="/login" className="inline-flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold tracking-tight ring-1 ring-white/25">
                E
              </span>
              <span className="text-lg font-semibold tracking-tight">Electronic ERP</span>
            </Link>
            <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight tracking-tight">
              Universal ERP for modern retail & wholesale operations
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Secure access to sales, catalog, inventory, finance, and branch operations — one workspace for your
              organization.
            </p>
          </div>
          <ul className="relative z-10 mt-10 space-y-3 text-sm text-white/85">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" aria-hidden />
              Role-based modules with consistent navigation
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" aria-hidden />
              POS, products, stock, and reporting in one system
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" aria-hidden />
              Built for desktop counters and mobile supervisors
            </li>
          </ul>
          <div className="erp-auth-brand-glow" aria-hidden />
        </aside>

        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-8 lg:items-stretch lg:px-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--erp-brand)] text-sm font-bold text-white">
                E
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--erp-ink)]">Electronic ERP</p>
                <p className="text-xs text-[var(--erp-muted)]">Organization workspace</p>
              </div>
            </div>

            <div className="rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-5 shadow-[var(--erp-shadow-md)] sm:p-7">
              <header className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-[var(--erp-ink)] sm:text-2xl">{title}</h2>
                {subtitle ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--erp-muted)]">{subtitle}</p> : null}
              </header>
              {children}
            </div>

            {footer ? <div className="mt-5 text-center text-sm text-[var(--erp-muted)]">{footer}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
