import { Link } from "react-router-dom";
import { POS_MODULES, type PosModuleDef } from "../ownership";

export type PosCommandCenterKpis = {
  holdCount: number;
  shiftOpen: boolean;
};

function cardMeta(mod: PosModuleDef, kpis?: PosCommandCenterKpis) {
  if (mod.kpiKey === "holds" && kpis) {
    return { label: "Held sales", value: String(kpis.holdCount) };
  }
  if (mod.kpiKey === "shift" && kpis) {
    return { label: "Shift", value: kpis.shiftOpen ? "Open" : "Closed" };
  }
  const live = mod.children.filter((c) => c.status === "live").length;
  const soon = mod.children.length - live;
  if (live > 0) return { label: "Ready", value: `${live} live` };
  return { label: "Planned", value: `${soon} screens` };
}

function statusTone(mod: PosModuleDef) {
  const live = mod.children.some((c) => c.status === "live");
  return live ? "live" : "soon";
}

export function PosCommandCenterPage({ kpis }: { kpis?: PosCommandCenterKpis }) {
  return (
    <div
      className="pos-command-center min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      data-testid="pos-command-center"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pos-primary)]">
              Point of Sale
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              POS Command Center
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              Choose a POS module to open its workspace. All sales operations stay inside this ERP POS
              environment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/pos/sales/new" className="pos-cc-btn-primary">
              <i className="fa-solid fa-plus" aria-hidden />
              New Sale
            </Link>
            <Link to="/pos/sales/held" className="pos-cc-btn-secondary">
              <i className="fa-solid fa-clock" aria-hidden />
              Held Sales
              {kpis && kpis.holdCount > 0 ? (
                <span className="pos-cc-badge">{kpis.holdCount}</span>
              ) : null}
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {POS_MODULES.map((mod) => {
            const meta = cardMeta(mod, kpis);
            const tone = statusTone(mod);
            return (
              <Link
                key={mod.id}
                to={mod.path}
                className="pos-cc-card group"
                data-pos-module={mod.id}
                aria-label={`Open ${mod.title}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="pos-cc-icon" aria-hidden>
                      <i className={`fa-solid ${mod.icon}`} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="pos-cc-number">{mod.number}</span>
                        <h2 className="truncate text-base font-semibold text-slate-900 group-hover:text-[var(--pos-primary)]">
                          {mod.title}
                        </h2>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                  <span className={`pos-cc-status pos-cc-status-${tone}`}>
                    {tone === "live" ? "Live" : "Soon"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {meta.label}
                    </p>
                    <p className="truncate text-sm font-semibold tabular-nums text-slate-800">{meta.value}</p>
                  </div>
                  <span className="pos-cc-open">
                    Open
                    <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
