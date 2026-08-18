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
        "flex flex-nowrap items-center justify-between gap-2 overflow-x-auto border-t border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-2",
        sticky && "sticky bottom-0 z-10",
        className,
      )}
    >
      <div className="flex shrink-0 flex-nowrap items-center gap-2">{left}</div>
      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">{right}</div>
    </div>
  );
}
