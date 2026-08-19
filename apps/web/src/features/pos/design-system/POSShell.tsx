import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isPosTerminalPath } from "@/app/modules";
import { hardwareApi } from "@/features/printing/hardware-api";
import { POSHeader } from "./POSHeader";
import { POSWorkspace } from "./POSWorkspace";
import { POSShortcutBar } from "./POSShortcutBar";
import { POSButton } from "./POSButton";
import { usePosShellStatus } from "../session/usePosShellStatus";
import { posHardware } from "../hardware";
import { dispatchPosShortcut, isPosOverlayOpen, posShortcutFallbackPath, resolvePosFunctionShortcut } from "../pos-ux";
import "../pos-tokens.css";

/**
 * POS operational tools inside the shared ModuleWorkspace.
 * Not a second application shell — header, context nav, and ERP chrome live above this.
 */
export function POSShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, branchId, branches, hasPermission } = useAuth();
  const { holdCount, shiftOpen, drawer, terminalOptions, terminalId, setTerminalId } = usePosShellStatus(
    branchId,
    branches,
  );
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const dense = isPosTerminalPath(location.pathname);
  const summary = drawer ?? { opening: "—", inHand: "—", sales: "—", expenses: "—", expected: "—" };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const action = resolvePosFunctionShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (isPosOverlayOpen()) return;
      const handled = dispatchPosShortcut(action);
      if (handled) return;
      const path = posShortcutFallbackPath(action);
      if (path && location.pathname !== path) navigate(path);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, location.pathname]);

  async function onCashDrawer() {
    setDrawerBusy(true);
    setDrawerMessage(null);
    try {
      const local = await posHardware.openDrawer({ reason: "POS workspace", userId: user?.id });
      if (!local.ok) {
        await hardwareApi.openDrawer({ reason: "POS workspace" });
      }
      setDrawerMessage("Drawer opened");
    } catch (err) {
      setDrawerMessage(err instanceof Error ? err.message : "Drawer unavailable");
    } finally {
      setDrawerBusy(false);
    }
  }

  return (
    <div className="pos-terminal flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <POSHeader
        terminalId={terminalId}
        terminalOptions={terminalOptions}
        onTerminalChange={setTerminalId}
        cashierName={user?.fullName}
        holdCount={holdCount}
        shiftOpen={shiftOpen}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--pos-border)] bg-[var(--pos-navy)] px-3 py-2 text-[11px] text-[var(--pos-nav-ink)]">
        <POSButton
          size="sm"
          variant="ghost"
          className="border border-white/20 bg-white/10 text-[var(--pos-nav-ink)] hover:bg-white/15"
          onClick={hasPermission("cash_drawer.open") ? () => void onCashDrawer() : undefined}
          disabled={!hasPermission("cash_drawer.open") || drawerBusy}
        >
          Cash Drawer
        </POSButton>
        <POSButton size="sm" variant="primary" onClick={() => navigate("/sales-management")}>
          Close Shift
        </POSButton>
        <dl className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
          <div className="flex gap-1">
            <dt className="text-[var(--pos-nav-muted)]">Opening</dt>
            <dd className="tabular-nums">{summary.opening}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-[var(--pos-nav-muted)]">In Hand</dt>
            <dd className="tabular-nums">{summary.inHand}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-[var(--pos-nav-muted)]">Sales</dt>
            <dd className="tabular-nums">{summary.sales}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-[var(--pos-nav-muted)]">Expenses</dt>
            <dd className="tabular-nums">{summary.expenses}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">Expected</dt>
            <dd className="font-semibold tabular-nums">{summary.expected}</dd>
          </div>
        </dl>
        {drawerMessage ? <p className="w-full text-[var(--pos-nav-muted)]">{drawerMessage}</p> : null}
      </div>

      <POSWorkspace dense={dense}>{children}</POSWorkspace>
      <POSShortcutBar />
    </div>
  );
}
