import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isPosTerminalPath } from "@/app/modules";
import { hardwareApi } from "@/features/printing/hardware-api";
import { POSHeader } from "./POSHeader";
import { POSWorkspace } from "./POSWorkspace";
import { POSTerminalNav } from "./POSTerminalNav";
import { POSShortcutBar } from "./POSShortcutBar";
import { usePosShellStatus } from "../session/usePosShellStatus";
import { posHardware } from "../hardware";
import { dispatchPosShortcut, isPosOverlayOpen, posShortcutFallbackPath, resolvePosFunctionShortcut } from "../pos-ux";
import "../pos-tokens.css";

/**
 * POS operational tools inside the shared ModuleWorkspace.
 * Terminal nav, header, workspace, and shortcuts — ERP chrome stays above this.
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
  const dense = isPosTerminalPath(location.pathname);
  const summary = drawer ?? { opening: "—", inHand: "—", sales: "—", expenses: "—", expected: "—" };
  const branchLabel = branchId
    ? branches.includes(branchId)
      ? `Branch ${branchId.slice(0, 8)}`
      : branchId.slice(0, 8)
    : "No branch";

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
    try {
      const local = await posHardware.openDrawer({ reason: "POS workspace", userId: user?.id });
      if (!local.ok) {
        await hardwareApi.openDrawer({ reason: "POS workspace" });
      }
    } catch {
      // Hardware unavailable — operator sees no drawer motion; no raw error in UI.
    } finally {
      setDrawerBusy(false);
    }
  }

  return (
    <div className="pos-terminal flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <POSHeader
        branchLabel={branchLabel}
        terminalId={terminalId}
        terminalOptions={terminalOptions}
        onTerminalChange={setTerminalId}
        cashierName={user?.fullName}
        holdCount={holdCount}
        shiftOpen={shiftOpen}
      />

      <div className="pos-terminal-body flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <POSTerminalNav
          holdCount={holdCount}
          drawer={summary}
          drawerBusy={drawerBusy}
          canOpenDrawer={hasPermission("cash_drawer.open")}
          onCashDrawer={() => void onCashDrawer()}
          onCloseShift={() => navigate("/sales-management")}
        />
        <POSWorkspace dense={dense}>{children}</POSWorkspace>
      </div>

      <POSShortcutBar />
    </div>
  );
}
