import { Link, useLocation } from "react-router-dom";
import { findPosChild, type PosModuleDef } from "../ownership";

export function PosHubPage({ section }: { section: PosModuleDef }) {
  const { pathname } = useLocation();
  const focused = findPosChild(pathname);
  const highlightPath = focused?.module.id === section.id ? focused.child.path : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--pos-workspace)]">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6">
        <div className="space-y-3">
          <Link to="/pos" className="pos-back-link">
            <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
            Back to POS Command Center
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pos-primary)]">
                {section.number} · POS Module
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {section.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{section.description}</p>
            </div>
            <Link to={section.path} className="pos-cc-btn-secondary shrink-0">
              Module home
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.children.map((link) => {
            const active = highlightPath === link.path || pathname === link.path;
            return (
              <Link
                key={link.path + link.title}
                to={link.path}
                className={`rounded-xl border bg-white p-4 shadow-sm transition hover:border-[var(--pos-primary)] hover:shadow-md ${
                  active ? "border-[var(--pos-primary)] ring-1 ring-[var(--pos-primary)]/20" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-800">{link.title}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      link.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {link.status === "live" ? "Live" : "Soon"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{link.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
