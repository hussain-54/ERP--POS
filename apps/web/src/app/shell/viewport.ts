import { useEffect, useState } from "react";

export type ViewportMode = "mobile" | "tablet" | "desktop";

export const VIEWPORT_MOBILE_QUERY = "(max-width: 767.98px)";
export const VIEWPORT_TABLET_QUERY = "(min-width: 768px) and (max-width: 1023.98px)";

export function readViewportMode(matchMedia: (query: string) => Pick<MediaQueryList, "matches">): ViewportMode {
  if (matchMedia(VIEWPORT_MOBILE_QUERY).matches) return "mobile";
  if (matchMedia(VIEWPORT_TABLET_QUERY).matches) return "tablet";
  return "desktop";
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>("desktop");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobile = window.matchMedia(VIEWPORT_MOBILE_QUERY);
    const tablet = window.matchMedia(VIEWPORT_TABLET_QUERY);
    const apply = () => {
      if (mobile.matches) setMode("mobile");
      else if (tablet.matches) setMode("tablet");
      else setMode("desktop");
    };
    apply();
    mobile.addEventListener("change", apply);
    tablet.addEventListener("change", apply);
    return () => {
      mobile.removeEventListener("change", apply);
      tablet.removeEventListener("change", apply);
    };
  }, []);

  return mode;
}
