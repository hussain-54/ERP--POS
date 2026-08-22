import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { PosHeader } from "./PosHeader";
import { PosSidebar } from "./PosSidebar";
import { PosShortcutBar } from "./PosShortcutBar";
import { usePosShell } from "../hooks/usePosShell";
import "../tokens.css";

export function PosShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, branchId, branches } = useAuth();
  const { holdCount, shiftOpen, drawer, terminalId } = usePosShell(branchId);
  const branchLabel = branchId
    ? branches.find((b) => b === branchId)
      ? `Branch ${branchId.slice(0, 8)}`
      : branchId.slice(0, 8)
    : "Main Branch";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.key.startsWith("F")) return;
      const map: Record<string, () => void> = {
        F1: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "new-sale" })),
        F2: () => navigate("/pos/sales/resume"),
        F3: () => navigate("/pos/customers"),
        F7: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "clear-cart" })),
        F8: () => window.dispatchEvent(new CustomEvent("pos:shortcut", { detail: "cancel-sale" })),
      };
      const action = map[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="pos-root pos-terminal flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PosHeader
        branchLabel={branchLabel}
        terminalId={terminalId}
        cashierName={user?.fullName}
        holdCount={holdCount}
        shiftOpen={shiftOpen}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <PosSidebar holdCount={holdCount} drawer={drawer} onCloseShift={() => navigate("/pos/shift")} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      <PosShortcutBar />
    </div>
  );
}
