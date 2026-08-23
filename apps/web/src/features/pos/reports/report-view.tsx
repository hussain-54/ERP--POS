import { money } from "../format";

export type ReportRow = {
  key: string;
  label: string;
  amount: number;
  qty?: number;
  meta?: Record<string, string | number>;
};

export function PosReportMetrics({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>;
}) {
  if (!items.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((m) => (
        <div key={m.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{m.label}</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{m.value}</p>
          {m.hint ? <p className="mt-0.5 text-[11px] text-slate-500">{m.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function PosReportTable({
  rows,
  amountLabel = "Amount",
  emptyMessage = "No rows for this period.",
}: {
  rows: ReportRow[];
  amountLabel?: string;
  emptyMessage?: string;
}) {
  if (!rows.length) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">{amountLabel}</th>
              <th className="hidden px-3 py-2 md:table-cell">Mix</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{row.qty ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{money(row.amount)}</td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[var(--pos-primary)]"
                      style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function mapNamedRows(raw: unknown): ReportRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        key: String(row.key ?? row.label ?? ""),
        label: String(row.label ?? row.key ?? "—"),
        amount: Number(row.amount ?? 0),
        qty: row.qty != null ? Number(row.qty) : undefined,
        meta: row.meta as Record<string, string | number> | undefined,
      };
    })
    .filter((r) => r.key || r.label);
}

export function recordRows(records: Record<string, number>, labelPrefix = ""): ReportRow[] {
  return Object.entries(records).map(([key, amount]) => ({
    key,
    label: labelPrefix ? `${labelPrefix}${key}` : key,
    amount: Number(amount),
  }));
}
