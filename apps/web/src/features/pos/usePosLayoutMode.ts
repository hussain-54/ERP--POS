import { useEffect, useState } from "react";
import {
  POS_DESKTOP_MIN,
  posLayoutMode,
  posSaleChrome,
  posShowsSplitRegister,
  type PosLayoutMode,
  type PosSaleChrome,
} from "./pos-layout";

export function usePosLayoutWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? POS_DESKTOP_MIN : window.innerWidth,
  );

  useEffect(() => {
    function sync() {
      setWidth(window.innerWidth);
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return width;
}

export function usePosLayout(): {
  width: number;
  mode: PosLayoutMode;
  chrome: PosSaleChrome;
  splitRegister: boolean;
} {
  const width = usePosLayoutWidth();
  return {
    width,
    mode: posLayoutMode(width),
    chrome: posSaleChrome(width),
    splitRegister: posShowsSplitRegister(width),
  };
}

export function usePosLayoutMode(): PosLayoutMode {
  return usePosLayout().mode;
}
