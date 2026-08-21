import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PosPage } from "./PosPage";

export type PosTerminalFocus = "search" | "customer" | "scan" | "payment" | "quick";

const FOCUS_BY_PATH: Record<string, PosTerminalFocus> = {
  "/pos/quick-sale": "quick",
  "/pos/product-search": "search",
  "/pos/products": "search",
  "/pos/customer-selection": "customer",
  "/pos/customers": "customer",
  "/pos/barcode-scanner": "scan",
  "/pos/split-payment": "payment",
};

/**
 * Routes terminal-embedded POS children through the same PosPage + domain engines.
 * Does not create a second cart or posting path.
 */
export function PosTerminalFocusPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const path = typeof window !== "undefined" ? window.location.pathname : "/pos";
  const focus = FOCUS_BY_PATH[path] ?? (params.get("focus") as PosTerminalFocus | null) ?? "search";

  useEffect(() => {
    // Normalize bookmarks to query so PosPage can apply focus once mounted under /pos.
    if (path !== "/pos" && path !== "/pos/new") {
      const next = new URLSearchParams();
      next.set("focus", focus);
      if (focus === "quick") next.set("mode", "easy");
      navigate({ pathname: "/pos", search: `?${next.toString()}` }, { replace: true });
    }
  }, [focus, navigate, path]);

  return <PosPage />;
}
