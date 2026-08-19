import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("erp-filter-bar", className)}>{children}</div>;
}
