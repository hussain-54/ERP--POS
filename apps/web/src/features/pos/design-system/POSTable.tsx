import type { ReactNode, TableHTMLAttributes } from "react";
import { posCn } from "./posCn";

export function POSTable({
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto">
      <table
        className={posCn("pos-data-table w-full min-w-max border-collapse text-left text-[13px]", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function POSTableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={posCn("pos-data-table-head sticky top-0 bg-[var(--pos-muted-bg)] text-[11px] font-semibold uppercase tracking-wide text-[var(--pos-muted)]", className)}>
      {children}
    </thead>
  );
}

export function POSTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--pos-border)] [&_tr:hover]:bg-[var(--pos-light)]">{children}</tbody>;
}

export function POSTh({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={posCn("whitespace-nowrap px-2.5 py-1.5 font-semibold", className)}>{children}</th>;
}

export function POSTd({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={posCn("px-2.5 py-1.5 align-middle", className)}>{children}</td>;
}
