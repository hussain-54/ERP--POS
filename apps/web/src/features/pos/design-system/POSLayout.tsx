import type { ReactNode } from "react";
import { posCn } from "./posCn";

/**
 * POS terminal workspace. Module navigation lives in the ERP AppShell —
 * this layout is the dense sales surface only (topbar + terminal).
 */
export function POSLayout({
  topbar,
  children,
  className,
}: {
  topbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={posCn("pos-terminal flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden", className)}>
      {topbar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-[var(--pos-bg)]">{children}</div>
    </div>
  );
}
