import { useState } from "react";
import { money } from "../format";

export function UnknownBarcodeDialog({
  open,
  barcode,
  hasCreatePermission = true,
  onClose,
  onSearchProduct,
  onManualEntry,
  onCreateProduct,
}: {
  open: boolean;
  barcode: string;
  hasCreatePermission?: boolean;
  onClose: () => void;
  onSearchProduct: (barcode: string) => void;
  onManualEntry: (item: { name: string; rate: number; qty: number; barcode: string }) => void;
  onCreateProduct?: (barcode: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"options" | "manual">("options");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [error, setError] = useState("");

  if (!open) return null;

  function handleAddManual() {
    setError("");
    const trimmed = manualName.trim();
    if (!trimmed) {
      setError("Please enter product name");
      return;
    }
    const price = Number(manualPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Please enter a valid price (0 or greater)");
      return;
    }
    onManualEntry({
      name: trimmed,
      rate: price,
      qty: Math.max(1, manualQty),
      barcode,
    });
    onClose();
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-md p-5 text-left"
        role="dialog"
        aria-modal
        aria-label="Product not found"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Warning Icon */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <i className="fa-solid fa-barcode text-lg" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Product not found.</h2>
              <p className="text-xs text-slate-500">
                Barcode: <span className="font-mono font-bold text-slate-900">{barcode || "Unknown"}</span>
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

        {activeTab === "options" ? (
          <div className="my-4 space-y-3">
            <p className="text-xs text-slate-600">
              No matching item was found for this barcode. Choose how you would like to proceed:
            </p>

            <div className="grid gap-2">
              {/* Option 1: Search Product */}
              <button
                type="button"
                onClick={() => {
                  onSearchProduct(barcode);
                  onClose();
                }}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-blue-500 hover:bg-blue-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                    <i className="fa-solid fa-magnifying-glass text-xs" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                      Search Product
                    </span>
                    <p className="text-[10px] text-slate-500">Search catalog manually by name or category</p>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-blue-600" />
              </button>

              {/* Option 2: Manual Entry */}
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                    <i className="fa-solid fa-pen-to-square text-xs" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                      Manual Entry
                    </span>
                    <p className="text-[10px] text-slate-500">Add custom item name & price directly to this sale</p>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-emerald-600" />
              </button>

              {/* Option 3: Create Product (Permission Controlled) */}
              {hasCreatePermission ? (
                <button
                  type="button"
                  onClick={() => {
                    onCreateProduct?.(barcode);
                    onClose();
                  }}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-indigo-500 hover:bg-indigo-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                      <i className="fa-solid fa-plus text-xs" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                        Create Product
                      </span>
                      <p className="text-[10px] text-slate-500">Add new product to master inventory with this barcode</p>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-indigo-600" />
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500">
                  <i className="fa-solid fa-lock text-slate-400" />
                  <span>Create Product is restricted to authorized roles (`products.create`).</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          /* Manual Entry Form */
          <div className="my-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Quick Manual Item Entry</span>
              <button
                type="button"
                onClick={() => setActiveTab("options")}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                ← Back to options
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Item Description / Name *
                <input
                  type="text"
                  autoFocus
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Universal Adapter Cable"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-slate-700">
                  Unit Price (Rs.) *
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>

              {manualPrice ? (
                <div className="rounded-lg bg-slate-50 p-2 text-right text-xs font-bold text-slate-700">
                  Line Total: <span className="text-blue-600">{money(Number(manualPrice) * manualQty)}</span>
                </div>
              ) : null}
            </div>

            {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("options")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddManual}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                Add to Cart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
