import { POSButton } from "./POSButton";
import { posCn } from "./posCn";

export interface POSSidebarProps {
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

/**
 * Cash-drawer / shift strip. Module 05 navigation lives in the ERP AppShell —
 * this is not a second sidebar.
 */
export function POSSidebar({
  collapsed,
  drawerSummary,
  onCloseShift,
}: POSSidebarProps) {
  if (collapsed) return null;
  const summary = drawerSummary ?? {
    opening: "—",
    inHand: "—",
    sales: "—",
    expenses: "—",
    expected: "—",
  };

  return (
    <div
      className={posCn(
        "flex min-w-0 flex-wrap items-center gap-3 overflow-x-hidden border-b border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-2 text-xs text-[var(--pos-muted)]",
      )}
    >
      <span className="font-medium text-[var(--pos-ink)]">Cash drawer</span>
      <span>Opening {summary.opening}</span>
      <span>In hand {summary.inHand}</span>
      <span>Sales {summary.sales}</span>
      <span>Expenses {summary.expenses}</span>
      <span className="font-semibold text-[var(--pos-ink)]">Expected {summary.expected}</span>
      {onCloseShift ? (
        <POSButton
          className="ml-auto"
          variant="ghost"
          size="sm"
          onClick={onCloseShift}
          title="Uses existing shift/drawer workflow when available"
        >
          Toggle shift
        </POSButton>
      ) : null}
    </div>
  );
}
