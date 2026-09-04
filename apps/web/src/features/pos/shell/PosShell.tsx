import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { POS_TOGGLE_SIDEBAR } from "./events";
import { PosHeader } from "./PosHeader";
import { PosSidebar } from "./PosSidebar";
import { PosShellProvider, usePosShellState } from "./PosShellContext";
import "../tokens.css";

function PosShellFrame({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, branchId, branches } = useAuth();
  const { holdCount, shiftOpen, drawer, terminalId } = usePosShellState();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const commandCenter = pathname === "/pos";
  const branchLabel = branchId
    ? branches.find((b) => b === branchId)
      ? `Branch ${branchId.slice(0, 8)}`
      : branchId.slice(0, 8)
    : "Main Branch";

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onToggle() {
      setMobileNavOpen((v) => !v);
    }
    window.addEventListener(POS_TOGGLE_SIDEBAR, onToggle);
    return () => window.removeEventListener(POS_TOGGLE_SIDEBAR, onToggle);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.key.startsWith("F") && event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (event.key !== "F2" && event.key !== "Escape") return;
      }
      const map: Record<string, () => void> = {
        F1: () => {
          navigate("/pos/sales/new");
          window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "new-sale" }));
        },
        F2: () => {
          if (!pathname.startsWith("/pos/sales/")) navigate("/pos/sales/new");
          window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "pay" }));
        },
        F3: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "customers" })),
        F4: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "hold" })),
        F5: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "discount" })),
        F6: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "delivery" })),
        F7: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "clear-cart" })),
        F8: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "customers" })),
        Escape: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "clear-cart" })),
      };
      const action = map[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, pathname]);

  return (
    <div className="pos-root pos-workspace flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PosHeader
        branchLabel={branchLabel}
        terminalId={terminalId}
        cashierName={user?.fullName}
        holdCount={holdCount}
        shiftOpen={shiftOpen}
        showBack={!commandCenter}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <PosSidebar
          holdCount={holdCount}
          drawer={drawer}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          onCloseShift={() => navigate("/pos/shifts")}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export function PosShell({ children }: { children: ReactNode }) {
  const { branchId } = useAuth();
  return (
    <PosShellProvider branchId={branchId}>
      <PosShellFrame>{children}</PosShellFrame>
    </PosShellProvider>
  );
}
