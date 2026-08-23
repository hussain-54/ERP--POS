import { createContext, useContext, type ReactNode } from "react";
import { usePosShell } from "../hooks/usePosShell";

type PosShellState = ReturnType<typeof usePosShell>;

const PosShellContext = createContext<PosShellState | null>(null);

export function PosShellProvider({
  branchId,
  children,
}: {
  branchId: string | null;
  children: ReactNode;
}) {
  const value = usePosShell(branchId);
  return <PosShellContext.Provider value={value}>{children}</PosShellContext.Provider>;
}

export function usePosShellState(): PosShellState {
  const ctx = useContext(PosShellContext);
  if (!ctx) {
    throw new Error("usePosShellState must be used within PosShellProvider");
  }
  return ctx;
}
