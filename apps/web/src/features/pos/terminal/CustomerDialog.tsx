import { useEffect, useState } from "react";
import type { Customer } from "@electronic-erp/contracts";
import { partiesApi } from "@/features/customers/parties-api";
import { useAuth } from "@/features/auth/AuthContext";
import { money } from "../format";
import type { PosCustomerView } from "../types";
import { emptyCustomer } from "../types";
import { enrichCustomerForPos, mapCustomerToPos } from "../customers/customer-utils";

export function CustomerDialog({
  open,
  mode,
  onClose,
  onSelect,
}: {
  open: boolean;
  mode: "select" | "create";
  onClose: () => void;
  onSelect: (c: PosCustomerView) => void;
}) {
  const { organizationId, hasPermission } = useAuth();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const canWrite = hasPermission("customers.write");

  useEffect(() => {
    if (!open || mode !== "select") return;
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
  }, [open, mode, q]);

  if (!open) return null;

  async function pick(c: Customer) {
    try {
      onSelect(await enrichCustomerForPos(c));
    } catch {
      onSelect(mapCustomerToPos(c));
    }
    onClose();
  }

  async function create() {
    if (!organizationId || !name.trim()) {
      setError("Name is required");
      return;
    }
    if (!canWrite) {
      setError("Missing customers.write permission");
      return;
    }
    setError("");
    try {
      const created = await partiesApi.createCustomer({
        organizationId,
        name: name.trim(),
        code: code.trim() || `C-${Date.now().toString(36).toUpperCase()}`,
        mobile: mobile.trim() || undefined,
        customerType: "retail",
        creditLimit: "0",
      });
      onSelect(await enrichCustomerForPos(created));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create customer");
    }
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal"
        role="dialog"
        aria-modal
        aria-label={mode === "create" ? "New customer" : "Select customer"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">
            {mode === "create" ? "New Customer" : "Select Customer"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {mode === "select" ? (
            <>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, or code…"
                className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[var(--pos-primary)] focus:outline-none"
              />
              <button
                type="button"
                className="mb-2 w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600"
                onClick={() => {
                  onSelect(emptyCustomer());
                  onClose();
                }}
              >
                Use Walk-in Customer
              </button>
              {loading ? <p className="text-xs text-slate-400">Loading…</p> : null}
              <ul className="space-y-1">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-[var(--pos-primary)]"
                      onClick={() => void pick(c)}
                    >
                      <span>
                        <span className="block text-sm font-bold text-slate-800">{c.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {c.code}
                          {c.mobile ? ` · ${c.mobile}` : ""} · Limit {money(Number(c.creditLimit ?? 0))} · Due{" "}
                          {money(Number(c.outstanding ?? 0))}
                        </span>
                      </span>
                      <i className="fa-solid fa-chevron-right text-xs text-slate-300" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="space-y-3">
              {!canWrite ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  You need customers.write to create customers.
                </p>
              ) : null}
              <label className="block text-xs font-semibold text-slate-600">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Phone
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  inputMode="tel"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Code (optional)
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => void create()}
                className="w-full rounded-xl bg-[var(--pos-primary)] py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                Create & Select
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
