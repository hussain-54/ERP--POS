import type { ReactNode } from "react";

export function PageContainer({
  children,
  fill = false,
}: {
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <div
      className={
        fill
          ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          : "min-w-0 max-w-full flex-1 overflow-x-auto px-3 py-3 sm:px-4 md:px-5 md:py-4"
      }
    >
      {children}
    </div>
  );
}
