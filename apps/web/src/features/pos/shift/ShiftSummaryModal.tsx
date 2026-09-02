import { money } from "../format";
import {
  printShiftSummaryReport,
  type ShiftClosingSummaryData,
} from "./shift-utils";

export function ShiftSummaryModal({
  open,
  data,
  onClose,
  onStartNewShift,
}: {
  open: boolean;
  data: ShiftClosingSummaryData | null;
  onClose: () => void;
  onStartNewShift?: () => void;
}) {
  if (!open || !data) return null;

  const isExact = data.difference === 0;
  const isSurplus = data.difference > 0;

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-lg p-5 text-left"
        role="dialog"
        aria-modal
        aria-label="Shift Closing Summary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <i className="fa-solid fa-receipt text-lg" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Shift Closing Summary</h2>
              <p className="text-xs text-slate-500">
                Shift #{data.shiftId.slice(0, 8)} · {data.duration} active
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

        {/* Cashier & Timing Info Card */}
        <div className="my-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Cashier</span>
            <p className="font-bold text-slate-800 truncate">{data.cashierName}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Opened</span>
            <p className="font-semibold text-slate-700">
              {new Date(data.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Closed</span>
            <p className="font-semibold text-slate-700">
              {new Date(data.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* 8-Point Financial Breakdown Matrix */}
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Financial Reconciliation
          </span>

          <div className="divide-y divide-slate-100">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Opening Cash (Float)</span>
              <span className="font-bold text-slate-800">Rs. {money(data.openingCash)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Cash Sales (+)</span>
              <span className="font-bold text-emerald-700">Rs. {money(data.cashSales)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Card Sales (Non-Drawer)</span>
              <span className="font-bold text-blue-700">Rs. {money(data.cardSales)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Wallet Sales (Non-Drawer)</span>
              <span className="font-bold text-purple-700">Rs. {money(data.walletSales)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Cash In (+)</span>
              <span className="font-bold text-emerald-700">Rs. {money(data.cashIn)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Cash Out / Drops (−)</span>
              <span className="font-bold text-amber-700">−Rs. {money(data.cashOut)}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Expenses (−)</span>
              <span className="font-bold text-red-700">−Rs. {money(data.expenses)}</span>
            </div>
          </div>

          {/* Totals Comparison Hero Banner */}
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-3 text-center text-white shadow-inner">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Expected</span>
              <span className="text-sm font-black">Rs. {money(data.expectedCash)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-blue-300 block">Counted</span>
              <span className="text-sm font-black text-blue-200">Rs. {money(data.actualCash)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Variance</span>
              <span
                className={`text-sm font-black ${
                  isExact
                    ? "text-emerald-400"
                    : isSurplus
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {data.difference >= 0 ? "+" : "−"}Rs. {money(Math.abs(data.difference))}
              </span>
            </div>
          </div>
        </div>

        {data.notes ? (
          <div className="my-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <strong>Notes:</strong> {data.notes}
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => printShiftSummaryReport(data)}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-98"
          >
            <i className="fa-solid fa-print text-xs" />
            <span>Print Shift Summary (80mm Thermal)</span>
          </button>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
            {onStartNewShift ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartNewShift();
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Open Next Shift
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
