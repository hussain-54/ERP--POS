import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isPosTerminalPath } from "@/app/modules";
import { hardwareApi } from "@/features/printing/hardware-api";
import { POSHeader } from "./POSHeader";
import { POSSidebar } from "./POSSidebar";
import { POSWorkspace } from "./POSWorkspace";
import { POSShortcutBar } from "./POSShortcutBar";
import { usePosLayoutMode } from "../usePosLayoutMode";
import { usePosShellStatus } from "../session/usePosShellStatus";
import { posHardware } from "../hardware";
import { posSidebarCollapsedByDefault } from "../pos-layout";
import {
  dispatchPosShortcut,
  isPosOverlayOpen,
  matchPosFunctionShortcut,
  posShortcutFallbackPath,
} from "../pos-ux";
import "../pos-tokens.css";

/**
 * One POS environment: header + dedicated sidebar + workspace + shortcut bar.
 * Reused by every POS operational page. ERP Home leaves this shell.
 */
export function POSShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, branchId, branches, setBranchId, logout, hasPermission, permissions } = useAuth();
  const {
    holdCount,
    shiftOpen,
    drawer,
    branchOptions,
    terminalOptions,
    terminalId,
    setTerminalId,
  } = usePosShellStatus(branchId, branches);
  const layoutMode = usePosLayoutMode();
  const [navOpen, setNavOpen] = useState(() => !posSidebarCollapsedByDefault(layoutMode));
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState<string | null>(null);
  const dense = isPosTerminalPath(location.pathname);
  const grantedCount = permissions.length;

  useEffect(() => {
    setNavOpen(!posSidebarCollapsedByDefault(layoutMode));
  }, [layoutMode]);

  useEffect(() => {
    if (layoutMode === "desktop") return;
    setNavOpen(false);
  }, [location.pathname, layoutMode]);

  useEffect(() => {
    if (!navOpen || layoutMode === "desktop") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen, layoutMode]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const action = matchPosFunctionShortcut(event);
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
      const local = await posHardware.openDrawer({ reason: "POS sidebar", userId: user?.id });
      if (!local.ok) {
        await hardwareApi.openDrawer({ reason: "POS sidebar" });
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
        branchId={branchId}
        branchOptions={branchOptions}
        onBranchChange={setBranchId}
        terminalId={terminalId}
        terminalOptions={terminalOptions}
        onTerminalChange={setTerminalId}
        cashierName={user?.fullName}
        holdCount={holdCount}
        shiftOpen={shiftOpen}
        onMenu={() => setNavOpen((value) => !value)}
        menuOpen={navOpen}
        userName={user?.fullName ?? "User"}
        onProfile={() => navigate("/settings")}
        onLogout={() => {
          void logout();
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {navOpen && layoutMode !== "desktop" ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/30 pos-nav-backdrop xl:hidden"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <POSSidebar
          open={navOpen}
          onNavigate={() => {
            if (layoutMode !== "desktop") setNavOpen(false);
          }}
          grantedCount={grantedCount}
          hasPermission={hasPermission}
          drawer={drawer}
          onCashDrawer={hasPermission("cash_drawer.open") ? () => void onCashDrawer() : undefined}
          onCloseShift={() => navigate("/sales-management")}
          drawerBusy={drawerBusy}
          drawerMessage={drawerMessage}
        />

        <POSWorkspace dense={dense}>{children}</POSWorkspace>
      </div>

      <POSShortcutBar />
    </div>
  );
}

export { POSShell as PosShell };
