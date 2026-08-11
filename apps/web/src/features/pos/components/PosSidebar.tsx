import { NavLink } from "react-router-dom";
import { Button } from "@electronic-erp/ui";

const NAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: "/", label: "ERP Home", end: true },
  { to: "/pos", label: "POS", end: true },
  { to: "/held-sales", label: "Hold / Resume" },
  { to: "/customers", label: "Customers" },
  { to: "/products", label: "Products" },
  { to: "/invoices", label: "Invoices" },
  { to: "/returns", label: "Returns" },
  { to: "/salesman", label: "Salesman" },
  { to: "/deliveries", label: "Deliveries" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  holdCount: number;
  drawerSummary?: {
    opening: string;
    inHand: string;
    sales: string;
    expenses: string;
    expected: string;
  };
  onCloseShift?: () => void;
}

export function PosSidebar({ collapsed, onToggle, holdCount, drawerSummary, onCloseShift }: Props) {
  const summary = drawerSummary ?? {
    opening: "—",
    inHand: "—",
    sales: "—",
    expenses: "—",
    expected: "—",
  };

  return (
    <aside
      className={`pos-sidebar flex flex-col border-r border-white/10 transition-all ${
        collapsed ? "w-[72px]" : "w-[240px]"
      }`}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed ? <span className="text-sm font-semibold tracking-wide">POS / Sales</span> : null}
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-lg text-white/80 hover:bg-white/10"
          onClick={onToggle}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 pb-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${
                isActive ? "pos-nav-active" : "text-white/80 hover:bg-white/10"
              }`
            }
          >
            <span className={collapsed ? "mx-auto" : ""}>
              {collapsed ? item.label.slice(0, 1) : item.label}
            </span>
            {!collapsed && item.to === "/held-sales" && holdCount > 0 ? (
              <span className="rounded-full bg-white/20 px-2 text-xs">{holdCount}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-white/10 p-3 text-xs text-white/75">
          <div className="mb-2 font-medium text-white">Cash Drawer</div>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Opening</dt><dd>{summary.opening}</dd></div>
            <div className="flex justify-between"><dt>In Hand</dt><dd>{summary.inHand}</dd></div>
            <div className="flex justify-between"><dt>Sales</dt><dd>{summary.sales}</dd></div>
            <div className="flex justify-between"><dt>Expenses</dt><dd>{summary.expenses}</dd></div>
            <div className="flex justify-between font-semibold text-white">
              <dt>Expected</dt>
              <dd>{summary.expected}</dd>
            </div>
          </dl>
          <Button
            className="mt-3 w-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            variant="secondary"
            size="sm"
            onClick={onCloseShift}
            title="Uses existing shift/drawer workflow when available"
          >
            Close Shift
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
