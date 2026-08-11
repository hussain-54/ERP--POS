import type { ReactNode, TableHTMLAttributes } from "react";
import { posCn } from "./posCn";

export function POSTable({
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="w-full overflow-auto">
      <table
        className={posCn("w-full border-collapse text-left text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function POSTableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={posCn("bg-[var(--pos-muted-bg)] text-xs uppercase tracking-wide text-[var(--pos-muted)]", className)}>
      {children}
    </thead>
  );
}

export function POSTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--pos-border)]">{children}</tbody>;
}

export function POSTh({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={posCn("px-3 py-2 font-semibold", className)}>{children}</th>;
}

export function POSTd({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={posCn("px-3 py-2 align-middle", className)}>{children}</td>;
}
