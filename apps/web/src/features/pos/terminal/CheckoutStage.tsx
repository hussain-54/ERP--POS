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
  // Digital / Card tender state
  const [reference, setReference] = useState("");
  const [digitalConfirmed, setDigitalConfirmed] = useState(true);

  // Partial payment state
  const [partialPaid, setPartialPaid] = useState<number>(() => roundMoney(totals.grand / 2));
  const [partialKind, setPartialKind] = useState<PosPaymentKind>("cash");
  const [partialRef, setPartialRef] = useState("");

  // Credit / Udhaar state
  const [creditDownPayment, setCreditDownPayment] = useState<number>(0);

  // Installment plan state
  const [downPayment, setDownPayment] = useState<number>(() => roundMoney(totals.grand * 0.2));
  const [installmentMonths, setInstallmentMonths] = useState<number>(3);
  const [downPaymentKind, setDownPaymentKind] = useState<PosPaymentKind>("cash");
  const [downPaymentRef, setDownPaymentRef] = useState("");
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Split payment rows
  const [splitRows, setSplitRows] = useState<SplitRow[]>(() => [
    newSplitRow("cash", String(roundMoney(totals.grand / 2))),
    newSplitRow("card", String(roundMoney(totals.grand - roundMoney(totals.grand / 2)))),
  ]);

  // Cash calculations
  const currentCash = cashReceived != null ? cashReceived : totals.grand;
  const changeToReturn = Math.max(0, roundMoney(currentCash - totals.grand));
  const isCashShort = paymentKind === "cash" && currentCash + 1e-9 < totals.grand;
  const isCashExact = paymentKind === "cash" && Math.abs(currentCash - totals.grand) < 0.01;

  // Split calculations
  const totalSplitAllocated = useMemo(() => {
    return roundMoney(splitRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0));
  }, [splitRows]);
  const splitRemaining = roundMoney(totals.grand - totalSplitAllocated);

  // Credit calculations
  const newUdhaarBalance = roundMoney(customer.outstanding + totals.grand - creditDownPayment);
  const isCreditOverLimit = customer.creditLimit > 0 && newUdhaarBalance > customer.creditLimit;
  const creditHeadroom = Math.max(0, roundMoney(customer.creditLimit - (customer.outstanding + totals.grand)));

  // Installment calculations
  const remainingInstallmentPrincipal = Math.max(0, roundMoney(totals.grand - downPayment));
  const monthlyInstallmentAmt = roundMoney(remainingInstallmentPrincipal / (installmentMonths || 1));

  // Quick cash buttons
  const quickCashPresets = [
    { label: "Exact", value: totals.grand },
    { label: "500", value: 500 },
    { label: "1,000", value: 1000 },
    { label: "2,000", value: 2000 },
    { label: "5,000", value: 5000 },
    { label: "10,000", value: 10000 },
  ];

  function resolveMethodId(kind: PosPaymentKind): string | null {
    const mapped = tenderToMethodKind(kind);
    return (
      methodsByKind[mapped] ??
      methodsByKind[kind] ??
      methodsByKind.online ??
      methodsByKind.bank ??
      methodsByKind.cash ??
      null
    );
  }

  function handleCompleteClick() {
    if (busy || lines.length === 0) return;

    // 1. Validate Cash
    if (paymentKind === "cash" && isCashShort) {
      alert(`Cash received is less than total payable (Short by Rs. ${money(totals.grand - currentCash)})`);
      return;
    }

    // 2. Validate Credit / Udhaar
    if (paymentKind === "credit") {
      if (!customer.id) {
        alert("Credit / Udhaar sales require an attached customer. Please select or add a customer.");
        onSelectCustomer();
        return;
      }
      if (creditDownPayment > 0) {
        const cashId = resolveMethodId("cash");
        const creditLines: PosPaymentLine[] = [
          {
            kind: "cash",
            paymentMethodId: cashId,
            amount: creditDownPayment,
            amountReceived: creditDownPayment,
            reference: reference || "Credit Down Payment",
          },
        ];
        onComplete(creditLines);
        return;
      }
      onComplete([]);
      return;
    }

    // 3. Validate Split
    if (paymentKind === "split") {
      if (Math.abs(splitRemaining) > 0.05) {
        alert(`Split tender sum (Rs. ${money(totalSplitAllocated)}) does not match Grand Total (Rs. ${money(totals.grand)}). Remaining: Rs. ${money(splitRemaining)}`);
        return;
      }
      const splitLines: PosPaymentLine[] = splitRows
        .filter((r) => Number(r.amount) > 0)
        .map((r) => ({
          kind: r.kind,
          paymentMethodId: resolveMethodId(r.kind),
          amount: roundMoney(Number(r.amount)),
          amountReceived: r.kind === "cash" ? roundMoney(Number(r.amount)) : undefined,
          reference: r.reference || undefined,
        }));
      onComplete(splitLines);
      return;
    }

    // 4. Validate Partial
    if (paymentKind === "partial") {
      if (!customer.id) {
        alert("Partial payment requires an attached customer for the remaining Udhaar balance.");
        onSelectCustomer();
        return;
      }
      const paid = roundMoney(Math.min(partialPaid, totals.grand));
      if (paid <= 0) {
        alert("Partial payment amount paid today must be greater than 0.");
        return;
      }
      const pMethodId = resolveMethodId(partialKind);
      const partialLines: PosPaymentLine[] = [
        {
          kind: partialKind,
          paymentMethodId: pMethodId,
          amount: paid,
          amountReceived: partialKind === "cash" ? paid : undefined,
          reference: partialRef || reference || "Partial Payment",
        },
      ];
      onComplete(partialLines);
      return;
    }

    // 5. Validate Installment
    if (paymentKind === "installment") {
      if (!customer.id) {
        alert("Installment plan requires an attached customer.");
        onSelectCustomer();
        return;
      }
      const down = roundMoney(Math.min(downPayment, totals.grand));
      if (down > 0) {
        const dMethodId = resolveMethodId(downPaymentKind);
        const installmentLines: PosPaymentLine[] = [
          {
            kind: downPaymentKind,
            paymentMethodId: dMethodId,
            amount: down,
            amountReceived: downPaymentKind === "cash" ? down : undefined,
            reference: downPaymentRef || reference || "Installment Down Payment",
          },
        ];
        onComplete(installmentLines);
        return;
      }
      onComplete([]);
      return;
    }

    // 6. Single Digital / Card / Bank / Wallet / QR
    if (["card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"].includes(paymentKind)) {
      const pMethodId = resolveMethodId(paymentKind);
      const digitalLines: PosPaymentLine[] = [
        {
          kind: paymentKind,
          paymentMethodId: pMethodId,
          amount: totals.grand,
          amountReceived: totals.grand,
          reference: reference || undefined,
        },
      ];
      onComplete(digitalLines);
      return;
    }

    // 7. Default Cash Full Payment
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
                  {couponCode ? `Coupon (${couponCode})` : totals.invoiceDiscount > 0 ? "Edit" : "+ Add"}
                </button>
              </span>
              <span className={totals.invoiceDiscount > 0 ? "text-red-600 font-bold" : ""}>
                {totals.invoiceDiscount > 0 ? `−${money(totals.invoiceDiscount)}` : "Rs. 0.00"}
              </span>
            </div>
            {totals.tax > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span>GST / Tax:</span>
                <span className="font-semibold text-slate-800">{money(totals.tax)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-black text-slate-900">
              <span>GRAND TOTAL:</span>
              <span className="text-blue-700">{money(totals.grand)}</span>
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
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-xs">
                  {PAYMENT_METHODS.find((m) => m.id === paymentKind)?.label ?? paymentKind}
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Method Selection & Dynamic Tender Form */}
          <div className="pos-zone-scroll min-h-0 flex-1 space-y-3 p-3">
            {/* Payment Method Selector Grid */}
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Select Payment Tender Method
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {PAYMENT_METHODS.map((m) => {
                  const active = paymentKind === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onPaymentKind(m.id)}
                      className={`relative flex flex-col items-center justify-center rounded-lg p-2 text-center transition ${
                        active
                          ? "border-2 border-blue-600 bg-blue-600 text-white shadow-xs"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <i
                        className={`fa-solid ${m.icon} mb-1 text-sm ${active ? "text-white" : m.color}`}
                        aria-hidden
                      />
                      <span className="truncate text-[10px] font-bold">{m.label}</span>
                      {active ? (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white shadow-xs">
                          ✓
                        </span>
                      ) : null}
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
                    Cash Tender Received
                  </span>
                  <div className="relative w-40">
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
                      className="w-full rounded-lg border-2 border-emerald-400 py-1.5 pl-8 pr-2 text-right text-base font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
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

                {/* Quick Increment Row */}
                <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                  <span>Quick Add:</span>
                  <button
                    type="button"
                    onClick={() => onCashReceived?.(roundMoney(currentCash + 100))}
                    className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200 text-slate-700"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => onCashReceived?.(roundMoney(currentCash + 500))}
                    className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200 text-slate-700"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => onCashReceived?.(roundMoney(currentCash + 1000))}
                    className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200 text-slate-700"
                  >
                    +1,000
                  </button>
                  <button
                    type="button"
                    onClick={() => onCashReceived?.(roundMoney(currentCash + 5000))}
                    className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200 text-slate-700"
                  >
                    +5,000
                  </button>
                  <button
                    type="button"
                    onClick={() => onCashReceived?.(0)}
                    className="ml-auto rounded bg-red-50 px-2 py-0.5 text-red-700 hover:bg-red-100"
                  >
                    Clear
                  </button>
                </div>

                {/* Change or Shortage Display */}
                {isCashShort ? (
                  <div className="rounded-lg bg-red-50 p-2.5 text-xs font-bold text-red-700 border border-red-200">
                    <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                    Insufficient cash: Short by {money(totals.grand - currentCash)}. Please collect full amount or choose Partial/Credit.
                  </div>
                ) : isCashExact ? (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-2 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <span>Exact Amount Received:</span>
                    <span>Rs. {money(currentCash)} (No change needed)</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-2.5 border border-emerald-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800">Change to Return</span>
                      <p className="text-xs text-emerald-700">Hand back to customer</p>
                    </div>
                    <span className="text-xl font-black text-emerald-700">{money(changeToReturn)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. SPLIT PAYMENT */}
            {paymentKind === "split" && (
              <div className="rounded-xl border border-blue-200 bg-white p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-blue-900">
                    <i className="fa-solid fa-scissors mr-1 text-blue-600" />
                    Split Tender Allocation
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSplitRows((prev) => [
                        ...prev,
                        newSplitRow("cash", String(Math.max(0, splitRemaining))),
                      ])
                    }
                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                  >
                    + Add Payment
                  </button>
                </div>

                <div className="space-y-2">
                  {splitRows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <select
                        value={row.kind}
                        onChange={(e) => {
                          const k = e.target.value as PosPaymentKind;
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, kind: k } : r)));
                        }}
                        className="rounded border border-slate-300 bg-white p-1 text-xs font-bold text-slate-800 focus:outline-none"
                      >
                        {PAYMENT_METHODS.filter((m) => m.id !== "split" && m.id !== "installment" && m.id !== "credit").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>

                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => {
                            const amt = e.target.value;
                            setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: amt } : r)));
                          }}
                          placeholder="Amount"
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-bold focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const otherTotal = splitRows
                            .filter((_, i) => i !== idx)
                            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                          const remainingForThis = Math.max(0, roundMoney(totals.grand - otherTotal));
                          setSplitRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: String(remainingForThis) } : r))
                          );
                        }}
                        className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                        title="Fill remaining amount"
                      >
                        Fill
                      </button>

                      <input
                        type="text"
                        value={row.reference}
                        onChange={(e) => {
                          const ref = e.target.value;
                          setSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, reference: ref } : r)));
                        }}
                        placeholder="Ref (opt)"
                        className="w-24 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs focus:outline-none"
                      />

                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove row"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                  <div>
                    <span className="text-slate-500">Total Allocated: </span>
                    <span className="font-bold text-slate-900">{money(totalSplitAllocated)}</span>
                  </div>
                  <div>
                    {Math.abs(splitRemaining) < 0.01 ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                        ✓ Exact Match (Rs. 0 Remaining)
                      </span>
                    ) : splitRemaining > 0 ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                        Remaining to Allocate: {money(splitRemaining)}
                      </span>
                    ) : (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">
                        Overallocated: {money(Math.abs(splitRemaining))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. CREDIT / UDHAAR */}
            {paymentKind === "credit" && (
              <div className="rounded-xl border border-amber-300 bg-white p-3 shadow-xs space-y-2.5">
                <span className="text-xs font-bold uppercase text-amber-900">
                  <i className="fa-solid fa-hand-holding-dollar mr-1 text-amber-600" />
                  Credit / Udhaar Ledger Posting
                </span>

                {!customer.id ? (
                  <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                    <p className="font-bold">⚠️ Customer Account Required</p>
                    <p className="mt-0.5 text-[11px]">
                      Credit/Udhaar sales cannot be booked for anonymous Walk-in customers.
                    </p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                    >
                      Attach or Select Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-amber-50/70 p-2.5 text-center text-xs border border-amber-200">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Previous Udhaar</span>
                        <p className="font-bold text-slate-800">{money(customer.outstanding)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">New Bill</span>
                        <p className="font-bold text-amber-700">+{money(totals.grand)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">New Balance</span>
                        <p className="font-black text-red-700">{money(newUdhaarBalance)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Optional Down Payment Today:</span>
                      <input
                        type="number"
                        min={0}
                        max={totals.grand}
                        value={creditDownPayment || ""}
                        onChange={(e) => setCreditDownPayment(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-28 rounded border border-slate-300 p-1 text-right text-xs font-bold focus:outline-none"
                      />
                    </div>

                    {isCreditOverLimit ? (
                      <div className="rounded-lg bg-red-50 p-2 text-[11px] font-bold text-red-700 border border-red-200">
                        <i className="fa-solid fa-triangle-exclamation mr-1" />
                        Warning: New balance ({money(newUdhaarBalance)}) exceeds customer credit limit ({money(customer.creditLimit)}).
                      </div>
                    ) : customer.creditLimit > 0 ? (
                      <div className="text-[10px] text-slate-500">
                        Credit Limit: {money(customer.creditLimit)} · Headroom remaining: {money(creditHeadroom)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* 4. PARTIAL PAYMENT */}
            {paymentKind === "partial" && (
              <div className="rounded-xl border border-orange-300 bg-white p-3 shadow-xs space-y-2.5">
                <span className="text-xs font-bold uppercase text-orange-900">
                  <i className="fa-solid fa-chart-pie mr-1 text-orange-600" />
                  Partial Payment (Deposit Now + Balance to Udhaar)
                </span>

                {!customer.id ? (
                  <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                    <p className="font-bold">⚠️ Customer Required for Balance</p>
                    <p className="mt-0.5 text-[11px]">
                      The remaining balance must be linked to a customer ledger.
                    </p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="mt-2 rounded bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      Attach Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Amount Paid Today:</span>
                      <input
                        type="number"
                        min={0}
                        max={totals.grand}
                        value={partialPaid || ""}
                        onChange={(e) => setPartialPaid(Number(e.target.value) || 0)}
                        className="w-32 rounded border-2 border-orange-400 px-2 py-1 text-right text-sm font-black focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500">Tender Method:</span>
                      <select
                        value={partialKind}
                        onChange={(e) => setPartialKind(e.target.value as PosPaymentKind)}
                        className="rounded border border-slate-300 bg-white p-1 text-xs font-bold"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">Easypaisa</option>
                        <option value="sadapay">SadaPay</option>
                      </select>
                      <input
                        type="text"
                        value={partialRef}
                        onChange={(e) => setPartialRef(e.target.value)}
                        placeholder="Ref / Trx ID (opt)"
                        className="flex-1 rounded border border-slate-300 p-1 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-bold">
                      <span className="text-slate-600">Remaining Balance Added to Udhaar:</span>
                      <span className="text-amber-700 text-sm font-black">
                        {money(Math.max(0, totals.grand - partialPaid))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. INSTALLMENT */}
            {paymentKind === "installment" && (
              <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-xs space-y-2.5">
                <span className="text-xs font-bold uppercase text-slate-900">
                  <i className="fa-solid fa-calendar mr-1 text-blue-600" />
                  Installment Financing Plan
                </span>

                {!customer.id ? (
                  <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                    <p className="font-bold">⚠️ Customer Required for Installment</p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Attach Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Down Payment</label>
                        <input
                          type="number"
                          value={downPayment || ""}
                          onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                          className="w-full rounded border border-slate-300 p-1.5 font-bold text-right text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Plan Duration</label>
                        <select
                          value={installmentMonths}
                          onChange={(e) => setInstallmentMonths(Number(e.target.value) || 3)}
                          className="w-full rounded border border-slate-300 p-1.5 font-bold text-xs"
                        >
                          <option value={3}>3 Months</option>
                          <option value={6}>6 Months</option>
                          <option value={12}>12 Months</option>
                          <option value={18}>18 Months</option>
                          <option value={24}>24 Months</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Down Tender Method</label>
                        <select
                          value={downPaymentKind}
                          onChange={(e) => setDownPaymentKind(e.target.value as PosPaymentKind)}
                          className="w-full rounded border border-slate-300 p-1.5 font-bold text-xs"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank Transfer</option>
                          <option value="jazzcash">JazzCash</option>
                          <option value="easypaisa">Easypaisa</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Down Payment Ref</label>
                        <input
                          type="text"
                          value={downPaymentRef}
                          onChange={(e) => setDownPaymentRef(e.target.value)}
                          placeholder="Trx / Ref (opt)"
                          className="w-full rounded border border-slate-300 p-1.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">First Due Date</label>
                        <input
                          type="date"
                          value={firstDueDate}
                          onChange={(e) => setFirstDueDate(e.target.value)}
                          className="w-full rounded border border-slate-300 p-1.5 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-blue-50 p-2 text-xs font-bold text-blue-900 border border-blue-200">
                      <span>Monthly Installment:</span>
                      <span className="text-sm font-black text-blue-700">
                        {money(monthlyInstallmentAmt)} / month ({installmentMonths}x)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. REFERENCE FOR CARD/BANK/WALLET/QR */}
            {["card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"].includes(paymentKind) && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-800">
                    Transaction & Reconciliation Reference
                  </span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    Amount: {money(totals.grand)}
                  </span>
                </div>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Card Auth ID, Bank Trx ID, JazzCash/Easypaisa TID, Slip #"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-none"
                />

                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={digitalConfirmed}
                    onChange={(e) => setDigitalConfirmed(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>I confirm this transaction has been authorized on the external terminal / app.</span>
                </label>
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
                placeholder="Salesman reference, warranty instructions, delivery info…"
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
