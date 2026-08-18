import type { ReactNode } from "react";
import { posCn } from "./posCn";

export function POSWorkspace({
  children,
  dense = false,
}: {
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <main
      className={posCn(
        "pos-workspace flex min-h-0 min-w-0 flex-1 flex-col",
        dense ? "overflow-hidden" : "overflow-auto p-4 md:p-5",
      )}
    >
      {children}
    </main>
  );
}

export { POSWorkspace as PosWorkspace };
