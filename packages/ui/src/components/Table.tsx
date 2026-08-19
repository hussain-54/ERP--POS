import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

export function Table({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "erp-table-scroll w-full overflow-auto rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)]",
        className,
      )}
      {...props}
    >
      <table className="erp-data-table min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-[var(--erp-muted-bg)] text-left text-[var(--erp-muted)]">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--erp-border)] bg-[var(--erp-surface)]">{children}</tbody>;
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn("hover:bg-[var(--erp-brand-soft)] active:bg-[var(--erp-brand-soft)]", onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2 text-[var(--erp-ink)]", className)} {...props}>
      {children}
    </td>
  );
}
