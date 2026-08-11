import type { ReactNode } from "react";
import { posCn } from "./posCn";

/**
 * POS terminal chrome: navy sidebar + white workspace.
 * Does not own business state — parent passes sidebar/topbar/content.
 */
export function POSLayout({
  sidebar,
  topbar,
  children,
  mobileSidebar,
  className,
}: {
  sidebar?: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  /** Overlay sidebar for small screens */
  mobileSidebar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={posCn("pos-terminal min-h-screen", className)}>
      <div className="flex min-h-screen">
        {sidebar ? <div className="hidden lg:flex">{sidebar}</div> : null}
        {mobileSidebar}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--pos-bg)]">
          {topbar}
          <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
        </div>
      </div>
    </div>
  );
}
