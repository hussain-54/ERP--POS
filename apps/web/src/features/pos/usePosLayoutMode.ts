import { useEffect, useState } from "react";
import { posLayoutMode, type PosLayoutMode } from "./pos-layout";

export function usePosLayoutMode(): PosLayoutMode {
  const [mode, setMode] = useState<PosLayoutMode>(() =>
    typeof window === "undefined" ? "desktop" : posLayoutMode(window.innerWidth),
  );

  useEffect(() => {
    function sync() {
      setMode(posLayoutMode(window.innerWidth));
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return mode;
}
