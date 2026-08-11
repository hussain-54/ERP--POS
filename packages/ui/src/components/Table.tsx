import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-auto rounded-xl border border-[var(--erp-border)]">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-[var(--erp-bg)] text-left text-[var(--erp-muted)]">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--erp-border)] bg-white">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-[rgba(15,106,92,0.04)]">{children}</tr>;
}

export function TH({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

export function TD({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 text-[var(--erp-ink)]">{children}</td>;
}
