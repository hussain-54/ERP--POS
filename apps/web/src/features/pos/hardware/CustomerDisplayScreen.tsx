import { useEffect, useState } from "react";
import type { CustomerDisplayState } from "./hardware-broadcast";
import { money } from "../format";

export function CustomerDisplayScreen() {
  const [state, setState] = useState<CustomerDisplayState>(() => {
    try {
      const raw = localStorage.getItem("erp_pos_customer_display_state");
      if (raw) return JSON.parse(raw) as CustomerDisplayState;
    } catch {
      // ignore
    }
    return {
      type: "idle",
      storeName: "Electronic & Electrical Store",
      customerName: "Valued Customer",
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      grandTotal: 0,
      timestamp: new Date().toISOString(),
    };
  });

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("pos_customer_display_channel");
      channel.onmessage = (e: MessageEvent<CustomerDisplayState>) => {
        if (e.data) setState(e.data);
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "erp_pos_customer_display_state" && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as CustomerDisplayState);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isPayment = state.type === "payment";
  const isCart = state.type === "cart" && state.items.length > 0;

  return (
    <div className="flex h-full min-h-[500px] flex-col rounded-2xl border border-slate-200 bg-slate-900 text-white overflow-hidden shadow-2xl">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xl shadow-md">
            <i className="fa-solid fa-bolt" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">{state.storeName || "Electronic Store"}</h1>
            <p className="text-xs text-slate-400">Customer Pole & Counter Display</p>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            Live POS Sync Active
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col p-6 overflow-hidden">
        {isPayment ? (
          /* Payment Completed Banner */
          <div className="flex flex-1 flex-col items-center justify-center text-center space-y-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <i className="fa-solid fa-circle-check text-5xl" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">Payment Received!</h2>
              <p className="mt-1 text-base text-slate-400">Thank you for shopping with us.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-800/80 p-5 border border-slate-700/60 max-w-md w-full">
              <div className="text-left">
                <span className="text-xs font-bold uppercase text-slate-400">Total Billed</span>
                <p className="text-2xl font-black text-white">{money(state.grandTotal)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase text-emerald-400">Paid ({state.paymentMethod || "Cash"})</span>
                <p className="text-2xl font-black text-emerald-400">{money(state.paidAmount ?? state.grandTotal)}</p>
              </div>
              {state.changeReturned != null && state.changeReturned > 0 ? (
                <div className="col-span-2 border-t border-slate-700/60 pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold uppercase text-emerald-300">Change Due:</span>
                  <span className="text-2xl font-black text-emerald-300">{money(state.changeReturned)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : isCart ? (
          /* Live Cart Breakdown */
          <div className="flex flex-1 gap-6 min-h-0">
            {/* Items Ledger (Left) */}
            <div className="flex flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-950/60 p-4 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs font-bold uppercase text-slate-400">
                <span>Billed Item Description</span>
                <span>Qty</span>
                <span className="text-right">Line Total</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
                {state.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-sm"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {money(item.price)} each ({item.unit})
                      </p>
                    </div>
                    <span className="rounded-lg bg-blue-900/60 px-3 py-1 font-mono font-bold text-blue-200">
                      ×{item.qty}
                    </span>
                    <span className="w-28 text-right font-black text-white text-base">
                      {money(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Payable Hero Card (Right) */}
            <div className="flex w-80 flex-col justify-between rounded-2xl border border-blue-900/40 bg-gradient-to-b from-blue-950/70 to-slate-950 p-6">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Transaction Summary</span>
                <div className="space-y-2 text-sm border-t border-slate-800 pt-3">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-bold text-white">{money(state.subtotal)}</span>
                  </div>
                  {state.discount > 0 ? (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Total Savings:</span>
                      <span>−{money(state.discount)}</span>
                    </div>
                  ) : null}
                  {state.tax > 0 ? (
                    <div className="flex justify-between text-slate-400">
                      <span>GST / Tax:</span>
                      <span className="font-bold text-white">{money(state.tax)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Dominant Total Box */}
              <div className="rounded-2xl bg-blue-600 p-5 text-center text-white shadow-lg">
                <span className="text-xs font-black uppercase tracking-widest text-blue-200">TOTAL PAYABLE</span>
                <p className="text-3xl font-black tracking-tight">{money(state.grandTotal)}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Idle Welcome Screen */
          <div className="flex flex-1 flex-col items-center justify-center text-center space-y-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <i className="fa-solid fa-cart-shopping text-3xl" />
            </div>
            <h2 className="text-2xl font-black text-white">Welcome!</h2>
            <p className="max-w-xs text-sm text-slate-400">
              Items scanned at the counter will appear here in real-time.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1.5 text-xs text-slate-300">
              <i className="fa-solid fa-barcode text-blue-400" />
              <span>Ready for next customer</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Strip */}
      <div className="border-t border-slate-800 bg-slate-950 px-6 py-2.5 text-center text-xs text-slate-500 flex items-center justify-between">
        <span>Customer: <strong>{state.customerName || "Valued Customer"}</strong></span>
        <span>Electronic ERP Point of Sale System</span>
      </div>
    </div>
  );
}
