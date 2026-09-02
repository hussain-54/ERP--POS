import { useState } from "react";
import type { PosCustomerView } from "../types";
import { money } from "../format";

export function HoldSaleDialog({
  open,
  itemCount,
  grandTotal,
  customer,
  initialNotes = "",
  initialRef = "",
  onClose,
  onConfirmHold,
}: {
  open: boolean;
  itemCount: number;
  grandTotal: number;
  customer?: PosCustomerView;
  initialNotes?: string;
  initialRef?: string;
  onClose: () => void;
  onConfirmHold: (data: { customerName?: string; reference: string; notes: string }) => Promise<void> | void;
}) {
  const [reference, setReference] = useState(initialRef);
  const [notes, setNotes] = useState(initialNotes);
  const [customerName, setCustomerName] = useState(customer?.label && customer.label !== "Walk-in Customer" ? customer.label : "");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleHold() {
    setBusy(true);
    try {
      await onConfirmHold({
        customerName: customerName.trim() || customer?.label || "Walk-in Customer",
        reference: reference.trim(),
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-md p-5 text-left"
        role="dialog"
        aria-modal
        aria-label="Hold Sale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <i className="fa-solid fa-hand-holding-dollar text-lg" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Hold Current Sale</h2>
              <p className="text-xs text-slate-500">
                Park this cart temporarily to serve the next customer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Cart Snapshot Summary Box */}
        <div className="my-3.5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Cart Contents</span>
            <p className="font-bold text-slate-800">
              {itemCount} {itemCount === 1 ? "Item" : "Items"} in Cart
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Value</span>
            <p className="text-sm font-black text-slate-900">{money(grandTotal)}</p>
          </div>
        </div>

        {/* Optional Metadata Inputs */}
        <div className="space-y-3">
          {/* Customer (Optional) */}
          <label className="block text-xs font-bold text-slate-700">
            <span className="flex items-center justify-between">
              <span>Customer Name</span>
              <span className="text-[10px] font-normal text-slate-400">Optional</span>
            </span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ali Ahmed / Walk-in"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* Reference / Token / Counter (Optional) */}
          <label className="block text-xs font-bold text-slate-700">
            <span className="flex items-center justify-between">
              <span>Reference / Token # / Counter</span>
              <span className="text-[10px] font-normal text-slate-400">Optional</span>
            </span>
            <input
              type="text"
              autoFocus
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Token-42, Counter 2, Customer looking for wallet"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </label>

          {/* Note (Optional) */}
          <label className="block text-xs font-bold text-slate-700">
            <span className="flex items-center justify-between">
              <span>Additional Note</span>
              <span className="text-[10px] font-normal text-slate-400">Optional</span>
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Waiting for spouse to confirm AC model..."
              className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleHold}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-98 disabled:opacity-50"
          >
            <i className="fa-solid fa-pause text-[11px]" />
            <span>{busy ? "Holding..." : "Hold Sale"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
