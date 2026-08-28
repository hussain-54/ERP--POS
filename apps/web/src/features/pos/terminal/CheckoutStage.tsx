import { useMemo, useState } from "react";
import type { CartLine, PosCustomerView, PosPaymentKind, PosPaymentLine } from "../types";
import { PAYMENT_METHODS, lineTotal, tenderToMethodKind } from "../types";
import { money } from "../format";
import { roundMoney } from "../payments/payment-utils";

type SplitRow = {
  id: string;
  kind: PosPaymentKind;
  amount: string;
  reference: string;
};

function newSplitRow(kind: PosPaymentKind = "cash", amount = ""): SplitRow {
  return { id: crypto.randomUUID?.() ?? String(Math.random()), kind, amount, reference: "" };
}

export function CheckoutStage({
  lines,
  customer,
  totals,
  paymentKind,
  onPaymentKind,
  cashReceived,
  onCashReceived,
  couponCode,
  notes,
  onNotes,
  onSelectCustomer,
  onWalkIn,
  onNewCustomer,
  onDiscount,
  onHold,
  onBackToCart,
  onComplete,
  methodsByKind,
  busy,
}: {
  lines: CartLine[];
  customer: PosCustomerView;
  totals: {
    itemCount: number;
    totalQty: number;
    taxable: number;
    itemDiscount: number;
    invoiceDiscount: number;
    tax: number;
    subtotal: number;
    totalDiscount: number;
    grand: number;
    expectedProfit: number | null;
  };
  paymentKind: PosPaymentKind;
  onPaymentKind: (k: PosPaymentKind) => void;
  cashReceived?: number;
  onCashReceived?: (amt: number) => void;
  couponCode: string;
  notes: string;
  onNotes: (v: string) => void;
  onSelectCustomer: () => void;
  onWalkIn: () => void;
  onNewCustomer: () => void;
  onDiscount: () => void;
  onHold: () => void;
  onBackToCart: () => void;
  onComplete: (overridePayments?: PosPaymentLine[]) => void;
  methodsByKind: Record<string, string>;
  busy?: boolean;
}) {
  const [reference, setReference] = useState("");
  const [partialPaid, setPartialPaid] = useState<number>(() => roundMoney(totals.grand / 2));
  const [downPayment, setDownPayment] = useState<number>(() => roundMoney(totals.grand * 0.2));
  const [installmentMonths, setInstallmentMonths] = useState<number>(3);
  const [splitRows, setSplitRows] = useState<SplitRow[]>(() => [
    newSplitRow("cash", String(roundMoney(totals.grand / 2))),
    newSplitRow("card", String(roundMoney(totals.grand - roundMoney(totals.grand / 2)))),
  ]);

  const currentCash = cashReceived != null ? cashReceived : totals.grand;
  const changeToReturn = Math.max(0, currentCash - totals.grand);
  const isCashShort = paymentKind === "cash" && currentCash + 1e-9 < totals.grand;

  // Split calculations
  const totalSplitAllocated = useMemo(() => {
    return splitRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  }, [splitRows]);
  const splitRemaining = roundMoney(totals.grand - totalSplitAllocated);

  const quickCashPresets = [
    { label: "Exact", value: totals.grand },
    { label: "500", value: 500 },
    { label: "1,000", value: 1000 },
    { label: "2,000", value: 2000 },
    { label: "5,000", value: 5000 },
    { label: "10,000", value: 10000 },
  ];

  function resolveMethodId(kind: PosPaymentKind): string | null {
    return methodsByKind[tenderToMethodKind(kind)] ?? methodsByKind.cash ?? null;
  }

  function handleCompleteClick() {
    if (busy || lines.length === 0) return;

    if (paymentKind === "cash" && isCashShort) {
      alert(`Cash received is less than total payable (Short by Rs. ${money(totals.grand - currentCash)})`);
      return;
    }

    if (paymentKind === "credit" && !customer.id) {
      alert("Credit / Udhaar sales require a selected customer. Please attach a customer.");
      onSelectCustomer();
      return;
    }

    if (paymentKind === "split") {
      if (Math.abs(splitRemaining) > 0.05) {
        alert(`Split tender sum (Rs. ${money(totalSplitAllocated)}) does not match Grand Total (Rs. ${money(totals.grand)})`);
        return;
      }
      const splitLines: PosPaymentLine[] = splitRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          kind: r.kind,
          paymentMethodId: resolveMethodId(r.kind),
          amount: Number(r.amount),
          amountReceived: r.kind === "cash" ? Number(r.amount) : undefined,
          reference: r.reference || undefined,
        }));
      onComplete(splitLines);
      return;
    }

    if (paymentKind === "partial") {
      if (!customer.id) {
        alert("Partial payment requires an attached customer for the remaining credit balance.");
        onSelectCustomer();
        return;
      }
      const paid = roundMoney(Math.min(partialPaid, totals.grand));
      const cashId = resolveMethodId("cash");
      const partialLines: PosPaymentLine[] = [
        {
          kind: "cash",
          paymentMethodId: cashId,
          amount: paid,
          amountReceived: paid,
          reference: reference || "Partial Cash Paid",
        },
      ];
      onComplete(partialLines);
      return;
    }

    onComplete();
  }

  return (
    <div className="pos-terminal-root flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
      {/* Checkout Top Bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToCart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
          >
            <i className="fa-solid fa-arrow-left text-[11px]" />
            Back to Cart (Esc)
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Checkout & Settlement Desk
            </h1>
            <p className="text-[10px] text-slate-400">
              Transaction Review · {lines.length} Items ({totals.totalQty} Units)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            TRX-{new Date().getFullYear()}-{lines.length}
          </span>
          <button
            type="button"
            onClick={onHold}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
          >
            <i className="fa-solid fa-pause mr-1 text-[10px]" />
            Hold (F6)
          </button>
        </div>
      </header>

      {/* Main 2-Column Split: Left = Order Review, Right = Payment Desk */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.1fr_1.15fr]">
        {/* ========================================================
            LEFT COLUMN: Order & Customer Ledger Review
           ======================================================== */}
        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-white" aria-label="Order review">
          {/* Customer Confirmation Header */}
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm">
                  <i className="fa-solid fa-user-check" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Billed Customer
                  </span>
                  <p className="text-xs font-black text-slate-900">{customer.label}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {customer.id ? (
                  <button
                    type="button"
                    onClick={onWalkIn}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Walk-in
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onNewCustomer}
                  className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                >
                  + New
                </button>
                <button
                  type="button"
                  onClick={onSelectCustomer}
                  className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                >
                  Change / Select
                </button>
              </div>
            </div>

            {/* Customer Details Pill */}
            <div className="mt-2 grid grid-cols-4 gap-1 rounded bg-white p-1.5 text-center text-[9px] border border-slate-200/70">
              <div>
                <span className="text-slate-400">Tier: </span>
                <span className="font-bold text-slate-800 uppercase">{customer.priceTier}</span>
              </div>
              <div>
                <span className="text-slate-400">Credit Limit: </span>
                <span className="font-bold text-slate-800">{money(customer.creditLimit)}</span>
              </div>
              <div>
                <span className="text-slate-400">Loyalty Points: </span>
                <span className="font-bold text-blue-600">{customer.loyaltyPoints}</span>
              </div>
              <div>
                <span className="text-slate-400">Udhaar: </span>
                <span className={`font-bold ${customer.outstanding > 0 ? "text-amber-700" : "text-slate-700"}`}>
                  {money(customer.outstanding)}
                </span>
              </div>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid shrink-0 grid-cols-[minmax(0,1.5fr)_70px_80px_60px_75px] items-center gap-1 border-b border-slate-200 bg-slate-100/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Item Details</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right">Disc</span>
            <span className="text-right">Total</span>
          </div>

          {/* Scrollable Items List */}
          <div className="pos-zone-scroll flex-1 p-2 space-y-1">
            {lines.map((line, idx) => {
              const isOverridden = line.rate !== line.listPrice;
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-[minmax(0,1.5fr)_70px_80px_60px_75px] items-center gap-1 rounded-lg border border-slate-100 bg-white p-2 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">{line.name}</p>
                      <p className="text-[9px] text-slate-400">
                        SKU: {line.sku} · {line.unitLabel}
                      </p>
                    </div>
                  </div>

                  <div className="text-center font-bold text-xs text-slate-800">
                    {line.qty}
                  </div>

                  <div className="text-right text-xs font-bold">
                    {isOverridden || line.listPrice > line.rate ? (
                      <div>
                        <span className="pos-price-original">{money(line.listPrice)}</span>
                        <span className="pos-price-selling">{money(line.rate)}</span>
                      </div>
                    ) : (
                      <span className="pos-price-selling">{money(line.rate)}</span>
                    )}
                  </div>

                  <div className="text-right text-xs font-bold text-red-600">
                    {line.discount > 0 ? `−${money(line.discount)}` : "0"}
                  </div>

                  <div className="text-right text-xs font-black text-slate-900">
                    {money(lineTotal(line))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Totals Ledger */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-bold text-slate-800">{money(totals.subtotal)}</span>
            </div>
            {totals.itemDiscount > 0 ? (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Item Level Discounts:</span>
                <span>−{money(totals.itemDiscount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-slate-600">
              <span className="flex items-center gap-1">
                Invoice Discount:
                <button type="button" onClick={onDiscount} className="text-[10px] font-bold text-blue-600 hover:underline">
                  ({totals.invoiceDiscount > 0 ? "Edit" : "+ Add"})
                </button>
              </span>
              <span className={totals.invoiceDiscount > 0 ? "font-bold text-red-600" : "text-slate-400"}>
                {totals.invoiceDiscount > 0 ? `−${money(totals.invoiceDiscount)}` : "0.00"}
              </span>
            </div>
            {couponCode ? (
              <div className="flex justify-between text-blue-700 font-semibold">
                <span>Coupon ({couponCode}):</span>
                <span>Applied</span>
              </div>
            ) : null}
            <div className="flex justify-between text-slate-600">
              <span>GST / Tax (17%):</span>
              <span className="font-semibold text-slate-800">{money(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-black text-slate-900">
              <span>Grand Total Payable:</span>
              <span className="text-base text-blue-700">{money(totals.grand)}</span>
            </div>
          </div>
        </section>

        {/* ========================================================
            RIGHT COLUMN: Payment & Settlement Engine
           ======================================================== */}
        <section className="flex min-h-0 flex-col bg-slate-50" aria-label="Payment settlement">
          {/* Header Banner: Big Grand Total */}
          <div className="shrink-0 bg-slate-900 p-3.5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Total Amount Due
                </span>
                <p className="text-2xl font-black tracking-tight text-white">{money(totals.grand)}</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-blue-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {paymentKind}
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Method Selection & Dynamic Tender Form */}
          <div className="pos-zone-scroll min-h-0 flex-1 space-y-3 p-3">
            {/* Payment Method Selector Grid */}
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Select Payment Method
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {PAYMENT_METHODS.map((m) => {
                  const active = paymentKind === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onPaymentKind(m.id)}
                      className={`flex flex-col items-center justify-center rounded-lg p-2 text-center transition ${
                        active
                          ? "border-2 border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <i className={`fa-solid ${m.icon} mb-1 text-sm ${m.color}`} aria-hidden />
                      <span className="truncate text-[10px] font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DYNAMIC TENDER FORMS */}

            {/* 1. CASH TENDER */}
            {paymentKind === "cash" && (
              <div className="rounded-xl border border-emerald-300 bg-white p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-900">
                    <i className="fa-solid fa-money-bill-wave mr-1 text-emerald-600" />
                    Cash Tender Amount
                  </span>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rs.
                    </span>
                    <input
                      type="number"
                      autoFocus
                      min={0}
                      value={currentCash || ""}
                      onChange={(e) => onCashReceived?.(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full rounded-lg border border-emerald-400 py-1.5 pl-8 pr-2 text-right text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {quickCashPresets.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => onCashReceived?.(q.value)}
                      className="pos-quick-cash-chip"
                    >
                      {q.label === "Exact" ? "Exact" : `Rs. ${q.label}`}
                    </button>
                  ))}
                </div>

                {/* Change or Shortage Display */}
                {isCashShort ? (
                  <div className="rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">
                    <i className="fa-solid fa-triangle-exclamation mr-1" />
                    Insufficient cash: Short by {money(totals.grand - currentCash)}
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-black">
                    <span className="text-emerald-900">Change to Return to Customer:</span>
                    <span className="text-lg font-black text-emerald-600">{money(changeToReturn)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. SPLIT PAYMENT */}
            {paymentKind === "split" && (
              <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-blue-900">
                    Split Tender Allocation
                  </span>
                  <button
                    type="button"
                    onClick={() => setSplitRows((prev) => [...prev, newSplitRow("cash", String(Math.max(0, splitRemaining)))])}
                    className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-200"
                  >
                    + Add Method
                  </button>
                </div>

                <div className="space-y-1.5">
                  {splitRows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <select
                        value={row.kind}
                        onChange={(e) => {
                          const k = e.target.value as PosPaymentKind;
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, kind: k } : r)));
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold"
                      >
                        {PAYMENT_METHODS.filter((m) => m.id !== "split" && m.id !== "partial").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        value={row.amount}
                        onChange={(e) => {
                          const amt = e.target.value;
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: amt } : r)));
                        }}
                        placeholder="Amount"
                        className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-bold"
                      />

                      <input
                        type="text"
                        value={row.reference}
                        onChange={(e) => {
                          const ref = e.target.value;
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, reference: ref } : r)));
                        }}
                        placeholder="Ref / Auth (opt)"
                        className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      />

                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <i className="fa-solid fa-xmark text-sm" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                  <div>
                    <span className="text-slate-500">Allocated: </span>
                    <span className="font-bold text-slate-800">{money(totalSplitAllocated)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Remaining: </span>
                    <span className={`font-bold ${splitRemaining === 0 ? "text-emerald-600" : "text-amber-700"}`}>
                      {money(splitRemaining)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. CREDIT / UDHAAR */}
            {paymentKind === "credit" && (
              <div className="rounded-xl border border-amber-300 bg-white p-3 shadow-xs space-y-2">
                <span className="text-xs font-bold uppercase text-amber-900">
                  <i className="fa-solid fa-hand-holding-dollar mr-1 text-amber-600" />
                  Credit / Udhaar Ledger Posting
                </span>

                {!customer.id ? (
                  <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    <p className="font-bold">⚠️ Customer Required</p>
                    <p className="mt-0.5 text-[11px]">Credit sales cannot be booked for Walk-in customers.</p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="mt-2 rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700"
                    >
                      Attach Customer
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-amber-50/50 p-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500">Current Udhaar</span>
                      <p className="font-bold text-slate-800">{money(customer.outstanding)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">New Bill</span>
                      <p className="font-bold text-amber-700">+{money(totals.grand)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">New Balance</span>
                      <p className="font-black text-red-700">{money(customer.outstanding + totals.grand)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. PARTIAL PAYMENT */}
            {paymentKind === "partial" && (
              <div className="rounded-xl border border-orange-300 bg-white p-3 shadow-xs space-y-2">
                <span className="text-xs font-bold uppercase text-orange-900">
                  Partial Payment (Deposit + Remainder to Udhaar)
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Amount Paid Today:</span>
                  <input
                    type="number"
                    value={partialPaid}
                    onChange={(e) => setPartialPaid(Number(e.target.value) || 0)}
                    className="w-32 rounded border border-slate-300 px-2 py-1 text-right text-xs font-bold"
                  />
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 text-xs font-bold">
                  <span>Balance Added to Udhaar:</span>
                  <span className="text-amber-700">{money(Math.max(0, totals.grand - partialPaid))}</span>
                </div>
              </div>
            )}

            {/* 5. INSTALLMENT */}
            {paymentKind === "installment" && (
              <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-xs space-y-2">
                <span className="text-xs font-bold uppercase text-slate-900">
                  Installment Plan
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold">Down Payment</label>
                    <input
                      type="number"
                      value={downPayment}
                      onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                      className="w-full rounded border border-slate-300 p-1 font-bold text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold">Months</label>
                    <select
                      value={installmentMonths}
                      onChange={(e) => setInstallmentMonths(Number(e.target.value) || 3)}
                      className="w-full rounded border border-slate-300 p-1 font-bold"
                    >
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months</option>
                      <option value={24}>24 Months</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 text-xs font-bold">
                  <span>Monthly Due (approx):</span>
                  <span className="text-blue-700">
                    {money(Math.max(0, (totals.grand - downPayment) / installmentMonths))} / mo
                  </span>
                </div>
              </div>
            )}

            {/* 6. REFERENCE FOR CARD/BANK/WALLET/QR */}
            {["card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"].includes(paymentKind) && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-1.5">
                <label className="block text-[10px] font-bold uppercase text-slate-500">
                  Transaction / Approval Reference (Optional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Card Auth ID, Trx ID, Slip #"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Sale Notes Input */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-1">
              <label className="block text-[10px] font-bold uppercase text-slate-500">
                Sale / Cashier Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
                placeholder="Salesman reference, delivery details, special instructions…"
                className="w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Pinned Action Footer */}
          <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Ready for Final Settlement:</span>
              <span className="text-base text-blue-700">{money(totals.grand)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToCart}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Modify Cart
              </button>

              <button
                type="button"
                disabled={busy || isCashShort}
                onClick={handleCompleteClick}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-98 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <i className="fa-solid fa-circle-check text-base" />
                {busy ? "Processing Settlement…" : `COMPLETE SALE (${money(totals.grand)})`}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
