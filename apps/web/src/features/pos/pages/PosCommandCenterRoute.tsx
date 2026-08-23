import { usePosShellState } from "../shell/PosShellContext";
import { PosCommandCenterPage as CommandCenterView } from "./PosCommandCenterPage";

export function PosCommandCenterRoute() {
  const { holdCount, shiftOpen } = usePosShellState();
  return <CommandCenterView kpis={{ holdCount, shiftOpen }} />;
}

// Re-export page for direct use
export { PosCommandCenterPage } from "./PosCommandCenterPage";
