import type { ReactNode } from "react";
import { posCn } from "./posCn";

export function POSActionBar({
  left,
  right,
  sticky = true,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={posCn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-2",
        sticky && "sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(21,34,56,0.04)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}
