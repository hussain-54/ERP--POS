import { useEffect, useState } from "react";
import type { Customer } from "@electronic-erp/contracts";
import { partiesApi } from "@/features/customers/parties-api";
import { money } from "../format";

/** Cashier-facing customer search — name, phone, or code (never UUID paste). */
export function CustomerSearchPanel({
  onPick,
  selectedId,
  autoFocus = true,
}: {
  onPick: (c: Customer) => void;
  selectedId?: string | null;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      setLoading(true);
      void partiesApi
        .listCustomers(q.trim() || undefined)
        .then((res) => {
          if (!cancelled) setItems(res.items);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 p-3">
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, or customer code…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[var(--pos-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pos-primary)]/20"
          aria-label="Search customers"
        />
        <p className="mt-1.5 text-[11px] text-slate-400">Matches name, mobile, and code — no UUID required.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Searching…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No customers found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((c) => {
              const active = selectedId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50/50 ${
                      active ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{c.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {c.code}
                        {c.mobile ? ` · ${c.mobile}` : ""} · Limit {money(Number(c.creditLimit ?? 0))}
                      </span>
                    </span>
                    <i className="fa-solid fa-chevron-right text-xs text-slate-300" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
