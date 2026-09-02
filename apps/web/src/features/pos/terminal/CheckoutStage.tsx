import { useEffect, useMemo, useState } from "react";
import type { CartLine, PosCustomerView, PosPaymentKind, PosPaymentLine } from "../types";
import { lineTotal, tenderToMethodKind } from "../types";
import { money } from "../format";
import { roundMoney } from "../payments/payment-utils";

export type PrimaryPaymentCategory =
  | "cash"
  | "card"
  | "bank"
  | "qr"
  | "wallet"
  | "split"
  | "partial"
  | "credit"
  | "installment";

export type SubWalletKind = "jazzcash" | "easypaisa" | "sadapay" | "wallet";

interface SplitPaymentRow {
  id: string;
  kind: PosPaymentKind;
  amount: string;
  reference: string;
}

function newSplitRow(kind: PosPaymentKind = "cash", amount = ""): SplitPaymentRow {
  return {
    id: crypto.randomUUID?.() ?? `split-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    amount,
    reference: "",
  };
}

export interface CheckoutStageProps {
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
    deliveryCharges?: number;
    roundOff?: number;
    grand: number;
    expectedProfit?: number | null;
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
  onComplete: (
    overridePayments?: PosPaymentLine[],
    options?: {
      installment?: { downPayment: string; installmentCount: number };
      cashReceived?: number;
    },
  ) => void;
  methodsByKind: Record<string, string>;
  busy?: boolean;
  paymentFlowState?: "idle" | "processing" | "success" | "failed";
}

export const PRIMARY_PAYMENT_METHODS: Array<{
  id: PrimaryPaymentCategory;
  label: string;
  icon: string;
  color: string;
  subtitle: string;
}> = [
  { id: "cash", label: "Cash", icon: "fa-money-bill-wave", color: "text-emerald-600", subtitle: "Cash & Change" },
  { id: "card", label: "Card", icon: "fa-credit-card", color: "text-blue-600", subtitle: "Debit / Credit POS" },
  { id: "bank", label: "Bank Transfer", icon: "fa-building-columns", color: "text-indigo-600", subtitle: "Online IBFT" },
  { id: "qr", label: "QR Payment", icon: "fa-qrcode", color: "text-purple-600", subtitle: "Raast / EMVCo QR" },
  { id: "wallet", label: "Mobile Wallet", icon: "fa-mobile-screen-button", color: "text-amber-600", subtitle: "JazzCash / Easy" },
  { id: "split", label: "Split Payment", icon: "fa-code-fork", color: "text-sky-600", subtitle: "Multi-Tender" },
  { id: "partial", label: "Partial Payment", icon: "fa-calculator", color: "text-teal-600", subtitle: "Pay Now + Due" },
  { id: "credit", label: "Credit / Udhaar", icon: "fa-book-bookmark", color: "text-rose-600", subtitle: "Customer Ledger" },
  { id: "installment", label: "Installment", icon: "fa-calendar-days", color: "text-violet-600", subtitle: "Monthly Schedule" },
];

export const MOBILE_WALLETS: Array<{
  id: SubWalletKind;
  label: string;
  icon: string;
  badgeColor: string;
}> = [
  { id: "jazzcash", label: "JazzCash", icon: "fa-bolt", badgeColor: "bg-amber-500 text-white" },
  { id: "easypaisa", label: "Easypaisa", icon: "fa-shield-halved", badgeColor: "bg-emerald-600 text-white" },
  { id: "sadapay", label: "SadaPay", icon: "fa-wallet", badgeColor: "bg-teal-500 text-white" },
  { id: "wallet", label: "Other Wallet", icon: "fa-mobile", badgeColor: "bg-slate-700 text-white" },
];

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
  busy = false,
  paymentFlowState = "idle",
}: CheckoutStageProps) {
  // Determine active primary category
  const [selectedCategory, setSelectedCategory] = useState<PrimaryPaymentCategory>(() => {
    if (paymentKind === "split") return "split";
    if (paymentKind === "installment") return "installment";
    if (paymentKind === "partial") return "partial";
    if (["jazzcash", "easypaisa", "sadapay", "wallet"].includes(paymentKind)) return "wallet";
    if (["card", "bank", "qr", "credit"].includes(paymentKind)) return paymentKind as PrimaryPaymentCategory;
    return "cash";
  });

  const [activeSubWallet, setActiveSubWallet] = useState<SubWalletKind>(() => {
    if (["jazzcash", "easypaisa", "sadapay", "wallet"].includes(paymentKind)) {
      return paymentKind as SubWalletKind;
    }
    return "jazzcash";
  });

  // Reference / Note states
  const [reference, setReference] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [walletPhone, setWalletPhone] = useState(customer.mobile || "");
  const [creditDownPayment, setCreditDownPayment] = useState<number>(0);

  // Partial Payment State
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(() => roundMoney(totals.grand * 0.5));
  const [partialMethod, setPartialMethod] = useState<PosPaymentKind>("cash");

  // Installment Plan State
  const [installmentDownPayment, setInstallmentDownPayment] = useState<number>(() => roundMoney(totals.grand * 0.2));
  const [installmentCount, setInstallmentCount] = useState<number>(6);

  // Split rows state
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>(() => [
    newSplitRow("cash", String(roundMoney(totals.grand / 2))),
    newSplitRow("card", String(roundMoney(totals.grand - roundMoney(totals.grand / 2)))),
  ]);

  // Sync category changes with paymentKind
  function handleSelectCategory(cat: PrimaryPaymentCategory) {
    setSelectedCategory(cat);
    if (cat === "wallet") {
      onPaymentKind(activeSubWallet);
    } else if (cat === "partial" || cat === "installment") {
      onPaymentKind(cat as PosPaymentKind);
    } else {
      onPaymentKind(cat as PosPaymentKind);
    }
  }

  function handleSelectSubWallet(sub: SubWalletKind) {
    setActiveSubWallet(sub);
    onPaymentKind(sub);
  }

  // Cash Calculations
  const currentCash = cashReceived != null ? cashReceived : totals.grand;
  const changeToReturn = Math.max(0, roundMoney(currentCash - totals.grand));
  const isCashShort = selectedCategory === "cash" && currentCash + 1e-9 < totals.grand;
  const balanceRemaining = Math.max(0, roundMoney(totals.grand - currentCash));

  // Smart Cash Preset Denominations
  const smartQuickAmounts = useMemo(() => {
    const grand = totals.grand;
    const presets: Array<{ label: string; value: number }> = [{ label: "Exact", value: grand }];

    const standardDenominations = [500, 1000, 2000, 5000, 10000];
    const filtered = standardDenominations.filter((d) => d > grand);

    // If grand total is between denominations, add the next immediate round multiple of 500
    if (grand > 500 && grand % 500 !== 0) {
      const next500 = Math.ceil(grand / 500) * 500;
      if (!filtered.includes(next500)) {
        presets.push({ label: money(next500), value: next500 });
      }
    }

    for (const d of filtered.slice(0, 4)) {
      presets.push({ label: money(d), value: d });
    }

    return presets;
  }, [totals.grand]);

  // Split Calculations
  const totalSplitAllocated = useMemo(() => {
    return roundMoney(splitRows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0));
  }, [splitRows]);
  const splitRemaining = roundMoney(totals.grand - totalSplitAllocated);
  const isSplitExact = Math.abs(splitRemaining) <= 0.01;

  // Partial Calculations
  const partialBalanceDue = Math.max(0, roundMoney(totals.grand - partialPaidAmount));
  const partialNewUdhaar = roundMoney(customer.outstanding + partialBalanceDue);

  // Credit Calculations
  const newUdhaarBalance = roundMoney(customer.outstanding + totals.grand - creditDownPayment);
  const isCreditOverLimit = customer.creditLimit > 0 && newUdhaarBalance > customer.creditLimit;
  const creditHeadroom = Math.max(0, roundMoney(customer.creditLimit - (customer.outstanding + totals.grand)));

  // Installment Calculations
  const installmentPrincipal = Math.max(0, roundMoney(totals.grand - installmentDownPayment));
  const monthlyInstallment = installmentCount > 0 ? roundMoney(installmentPrincipal / installmentCount) : 0;

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

    // 1. Cash Validation
    if (selectedCategory === "cash") {
      if (isCashShort) {
        alert(
          `Cash received (Rs. ${money(currentCash)}) is less than total due (Rs. ${money(totals.grand)}). Balance remaining: Rs. ${money(balanceRemaining)}`,
        );
        return;
      }
      onComplete(undefined, { cashReceived: currentCash });
      return;
    }

    // 2. Credit / Udhaar Validation
    if (selectedCategory === "credit") {
      if (!customer.id) {
        alert("Credit / Udhaar sale requires an attached registered customer. Please select or add a customer.");
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
            reference: reference ? `Credit Down: ${reference}` : "Credit Down Payment",
          },
        ];
        onComplete(creditLines);
        return;
      }
      onComplete([]);
      return;
    }

    // 3. Partial Payment Validation
    if (selectedCategory === "partial") {
      if (!customer.id) {
        alert("Partial payment requires an attached customer for remaining balance due. Please select a customer.");
        onSelectCustomer();
        return;
      }
      if (partialPaidAmount <= 0) {
        alert("Partial payment amount paid today must be greater than 0.");
        return;
      }
      if (partialPaidAmount >= totals.grand) {
        alert("Partial payment paid amount is equal to or greater than total. Please select standard payment.");
        return;
      }
      const partialLines: PosPaymentLine[] = [
        {
          kind: partialMethod,
          paymentMethodId: resolveMethodId(partialMethod),
          amount: partialPaidAmount,
          amountReceived: partialPaidAmount,
          reference: reference ? `Partial Payment: ${reference}` : `Partial Payment (Bal Rs. ${money(partialBalanceDue)})`,
        },
      ];
      onComplete(partialLines);
      return;
    }

    // 4. Installment Plan Validation
    if (selectedCategory === "installment") {
      if (!customer.id) {
        alert("Installment plan requires an attached registered customer. Please select or add a customer.");
        onSelectCustomer();
        return;
      }
      if (installmentDownPayment > 0) {
        const cashId = resolveMethodId("cash");
        const installLines: PosPaymentLine[] = [
          {
            kind: "cash",
            paymentMethodId: cashId,
            amount: installmentDownPayment,
            amountReceived: installmentDownPayment,
            reference: `Down Payment: ${installmentCount}M plan`,
          },
        ];
        onComplete(installLines, {
          installment: {
            downPayment: String(installmentDownPayment),
            installmentCount,
          },
        });
        return;
      }
      onComplete([], {
        installment: {
          downPayment: String(installmentDownPayment),
          installmentCount,
        },
      });
      return;
    }

    // 5. Split Payment Validation
    if (selectedCategory === "split") {
      if (!isSplitExact) {
        alert(
          `Split total (Rs. ${money(totalSplitAllocated)}) must match Total Due (Rs. ${money(totals.grand)}). Remaining difference: Rs. ${money(splitRemaining)}`,
        );
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

    // 6. Digital / Card / Bank / QR / Mobile Wallet
    const targetKind: PosPaymentKind = selectedCategory === "wallet" ? activeSubWallet : (selectedCategory as PosPaymentKind);
    const pMethodId = resolveMethodId(targetKind);
    const fullRef = [
      targetKind === "card" && cardLast4 ? `Card: **** ${cardLast4}` : "",
      selectedCategory === "wallet" && walletPhone ? `Wallet: ${walletPhone}` : "",
      reference ? `Ref: ${reference}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const digitalLines: PosPaymentLine[] = [
      {
        kind: targetKind,
        paymentMethodId: pMethodId,
        amount: totals.grand,
        amountReceived: totals.grand,
        reference: fullRef || undefined,
      },
    ];
    onComplete(digitalLines);
  }

  // Keyboard shortcut listener for Enter / Esc
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onBackToCart();
      }
      if (e.key === "Enter" && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCompleteClick();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="pos-checkout-overlay flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 1. CLEAN CHECKOUT HEADER */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToCart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-98"
          >
            <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
            <span>Back to Cart (Esc)</span>
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900">
              POS Terminal Checkout
            </h1>
            <p className="text-[10px] text-slate-400">
              {lines.length} {lines.length === 1 ? "Item" : "Items"} · {totals.totalQty} Units · Settle & Finalize
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Customer Attachment Pill */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
            <i className="fa-solid fa-user text-blue-600 text-[11px]" />
            <span className="font-bold text-slate-800">{customer.label}</span>
            <span className="text-[10px] text-slate-400">({customer.priceTier})</span>
            {customer.id ? (
              <button
                type="button"
                onClick={onWalkIn}
                className="ml-1 text-[10px] font-bold text-slate-500 hover:text-slate-700"
                title="Reset to Walk-in customer"
              >
                Walk-in
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNewCustomer}
              className="ml-1 text-[10px] font-bold text-emerald-600 hover:underline"
              title="Add new customer"
            >
              + New
            </button>
            <button
              type="button"
              onClick={onSelectCustomer}
              className="ml-1 text-[10px] font-bold text-blue-600 hover:underline"
            >
              {customer.id ? "Change" : "+ Attach"}
            </button>
          </div>

          <button
            type="button"
            onClick={onHold}
            disabled={busy}
            title="Hold sale (F6)"
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
          >
            <i className="fa-solid fa-pause text-[10px]" />
            <span>Hold</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN CHECKOUT PANEL */}
      <div className="pos-checkout-overlay-body">
        {/* ========================================================
            LEFT COLUMN: ORDER SUMMARY & PROMINENT DUE CARD
           ======================================================== */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-slate-200 bg-white" aria-label="Order summary">
          {/* PROMINENT TOTAL DUE HERO BANNER */}
          <div className="shrink-0 bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-blue-300">
                  Total Payable
                </span>
                <p className="text-3xl font-black tracking-tight text-white">
                  Rs. {money(totals.grand)}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/60 px-3 py-1 text-xs font-bold text-blue-100">
                  <i className="fa-solid fa-receipt text-[10px]" />
                  <span>{lines.length} Items ({totals.totalQty} pcs)</span>
                </span>
              </div>
            </div>

            {/* Financial Summary Strip */}
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800 pt-2 text-xs text-slate-300">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Subtotal</span>
                <span className="font-bold">{money(totals.subtotal)}</span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 uppercase">Discounts</span>
                  {onDiscount ? (
                    <button
                      type="button"
                      onClick={onDiscount}
                      className="text-[9px] font-bold text-blue-400 hover:underline"
                    >
                      ({totals.invoiceDiscount > 0 ? "Edit" : "+ Add"})
                    </button>
                  ) : null}
                </div>
                <span className={totals.totalDiscount > 0 ? "font-bold text-emerald-400" : ""}>
                  {totals.totalDiscount > 0 ? `−${money(totals.totalDiscount)}` : "0.00"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">GST / Tax</span>
                <span className="font-bold">{money(totals.tax)}</span>
              </div>
            </div>
          </div>

          {/* Scrollable Order Items List */}
          <div className="pos-zone-scroll flex-1 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1 border-b border-slate-100">
              <span>Item details</span>
              <span className="text-right">Subtotal</span>
            </div>

            {lines.map((line, idx) => (
              <div
                key={line.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs transition hover:bg-slate-100/80"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold text-slate-500 border border-slate-200">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900" title={line.name}>
                      {line.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      SKU: {line.sku || "—"} · {line.qty} {line.unitLabel} × {money(line.rate)}
                      {line.discount > 0 ? ` (Disc: −${money(line.discount)})` : ""}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right font-black text-slate-900">
                  {money(lineTotal(line))}
                </div>
              </div>
            ))}
          </div>

          {/* Financial Breakdown Table & Customer Ledger Strip */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">{money(totals.subtotal)}</span>
              </div>
              {totals.itemDiscount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Item Discounts</span>
                  <span>−{money(totals.itemDiscount)}</span>
                </div>
              ) : null}
              {totals.invoiceDiscount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Invoice Discount {couponCode ? `(${couponCode})` : ""}</span>
                  <span>−{money(totals.invoiceDiscount)}</span>
                </div>
              ) : null}
              {totals.taxable > 0 ? (
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Taxable Base</span>
                  <span>{money(totals.taxable)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-600">
                <span>Sales Tax (GST 17%)</span>
                <span>{money(totals.tax)}</span>
              </div>
              {totals.deliveryCharges ? (
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charges</span>
                  <span>+{money(totals.deliveryCharges)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-400 text-[10px] border-t border-slate-100 pt-1">
                <span>Round Off</span>
                <span>0.00</span>
              </div>
            </div>

            {customer.id ? (
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-2 text-center text-[10px]">
                <div>
                  <span className="text-slate-400">Udhaar Due:</span>
                  <p className={`font-black ${customer.outstanding > 0 ? "text-amber-700" : "text-slate-700"}`}>
                    {money(customer.outstanding)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Credit Limit:</span>
                  <p className="font-bold text-slate-800">{money(customer.creditLimit)}</p>
                </div>
                <div>
                  <span className="text-slate-400">Loyalty Pts:</span>
                  <p className="font-bold text-blue-600">{customer.loyaltyPoints}</p>
                </div>
              </div>
            ) : null}

            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
                placeholder="Sale note / reference / salesman code (optional)…"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* ========================================================
            RIGHT COLUMN: PAYMENT METHOD & TRANSACTION SETTLEMENT
           ======================================================== */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50" aria-label="Payment selection">
          {/* Scrollable Middle Area */}
          <div className="pos-zone-scroll min-h-0 flex-1 p-4 space-y-4">
            {/* 1. SELECT PAYMENT METHOD GRID */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Select Payment Method
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {PRIMARY_PAYMENT_METHODS.find((m) => m.id === selectedCategory)?.subtitle}
                </span>
              </div>

              {/* Clean Selectable Cards */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRIMARY_PAYMENT_METHODS.map((m) => {
                  const isActive = selectedCategory === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectCategory(m.id)}
                      className={`relative flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                        isActive
                          ? "border-blue-600 bg-white shadow-sm ring-2 ring-blue-600/30"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <i className={`fa-solid ${m.icon} text-xs`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-black truncate ${isActive ? "text-blue-700" : "text-slate-900"}`}>
                          {m.label}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate">{m.subtitle}</p>
                      </div>
                      {isActive ? (
                        <div className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white">
                          ✓
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CONDITIONAL PAYMENT FORMS */}

            {/* ========================================================
                A. CASH PAYMENT FORM
               ======================================================== */}
            {selectedCategory === "cash" && (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Due
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                      <i className="fa-solid fa-money-bill-wave" />
                      <span>Cash Tender</span>
                    </span>
                  </div>
                </div>

                {/* Cash Received Input */}
                <div>
                  <label htmlFor="pos-cash-input" className="block text-xs font-bold text-slate-700 mb-1">
                    Cash Received from Customer
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      Rs.
                    </span>
                    <input
                      id="pos-cash-input"
                      type="number"
                      autoFocus
                      min={0}
                      step="any"
                      value={currentCash || ""}
                      onChange={(e) => onCashReceived?.(Number(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      placeholder={String(totals.grand)}
                      className="w-full rounded-xl border-2 border-emerald-500 py-2 pl-10 pr-4 text-right text-xl font-black text-slate-900 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Smart Quick Amount Buttons */}
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Quick Amounts
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {smartQuickAmounts.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => onCashReceived?.(q.value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                          Math.abs(currentCash - q.value) < 0.01
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {q.label === "Exact" ? `Exact (Rs. ${money(q.value)})` : `Rs. ${q.label}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PROMINENT CHANGE BANNER */}
                <div
                  className={`flex items-center justify-between rounded-xl p-3.5 transition ${
                    isCashShort
                      ? "border border-red-200 bg-red-50 text-red-900"
                      : changeToReturn > 0
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "border border-blue-200 bg-blue-50 text-blue-900"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {isCashShort ? "Balance Remaining / Short" : "Change to Return"}
                    </span>
                    <p className={`text-2xl font-black ${isCashShort ? "text-red-600" : "text-emerald-700"}`}>
                      {isCashShort ? `−Rs. ${money(balanceRemaining)}` : `Rs. ${money(changeToReturn)}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="rounded-md bg-white/80 px-2 py-1 text-xs font-bold shadow-xs">
                      {isCashShort
                        ? "Insufficient cash"
                        : changeToReturn === 0
                          ? "Exact amount"
                          : "Give change to customer"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                B. CARD PAYMENT FORM
               ======================================================== */}
            {selectedCategory === "card" && (
              <div className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount Due
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                    <i className="fa-solid fa-credit-card" />
                    <span>POS Terminal</span>
                  </span>
                </div>

                <div className="rounded-xl bg-blue-50/70 p-3 text-xs text-blue-900 border border-blue-100">
                  <p className="font-bold">Swipe / Tap Card on Bank POS Machine</p>
                  <p className="mt-0.5 text-[11px] text-blue-700">
                    Charge exactly <span className="font-bold">Rs. {money(totals.grand)}</span> on customer card.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Card Last 4 Digits (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardLast4}
                      onChange={(e) => setCardLast4(e.target.value)}
                      placeholder="e.g. 4021"
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Approval / Auth Code
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. AUTH-9281"
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                C. BANK TRANSFER FORM
               ======================================================== */}
            {selectedCategory === "bank" && (
              <div className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount Due
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                    <i className="fa-solid fa-building-columns" />
                    <span>Direct IBFT</span>
                  </span>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
                  <p className="font-bold">Official Business Bank Account</p>
                  <p className="mt-0.5 text-[11px] text-indigo-700">
                    Meezan Bank Ltd · IBAN: PK00MEZN0001234567890101
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank Transaction / Reference ID
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. FT260830918239"
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ========================================================
                D. QR PAYMENT FORM
               ======================================================== */}
            {selectedCategory === "qr" && (
              <div className="space-y-3 rounded-2xl border border-purple-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount Due
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-800">
                    <i className="fa-solid fa-qrcode" />
                    <span>Raast / EMVCo QR</span>
                  </span>
                </div>

                <div className="flex items-center gap-4 rounded-xl border border-purple-100 bg-purple-50/50 p-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-600 shadow-xs">
                    <i className="fa-solid fa-qrcode text-4xl" />
                  </div>
                  <div className="text-xs text-purple-950">
                    <p className="font-bold text-sm">Scan to Pay via any Banking App</p>
                    <p className="mt-0.5 text-[11px] text-purple-700">
                      Raast P2M Instant QR for Rs. <span className="font-bold">{money(totals.grand)}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Receipt / Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. RAAST-839218"
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ========================================================
                E. MOBILE WALLET FORM (JazzCash, EasyPaisa, SadaPay, etc.)
               ======================================================== */}
            {selectedCategory === "wallet" && (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount Due
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    <i className="fa-solid fa-mobile-screen-button" />
                    <span>Mobile Wallet</span>
                  </span>
                </div>

                {/* Sub-Wallet Selector */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Mobile Wallet Provider
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MOBILE_WALLETS.map((w) => {
                      const isSubActive = activeSubWallet === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => handleSelectSubWallet(w.id)}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                            isSubActive
                              ? "border-amber-500 bg-amber-50/80 shadow-xs ring-2 ring-amber-500/30"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${w.badgeColor}`}
                          >
                            <i className={`fa-solid ${w.icon} text-xs`} />
                          </div>
                          <span className="truncate text-xs font-bold text-slate-900">{w.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Phone & Reference Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer Wallet Phone
                    </label>
                    <input
                      type="text"
                      value={walletPhone}
                      onChange={(e) => setWalletPhone(e.target.value)}
                      placeholder="03001234567"
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Transaction ID (TID)
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. TID-982173"
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                F. SPLIT PAYMENT FORM
               ======================================================== */}
            {selectedCategory === "split" && (
              <div className="space-y-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Due to Split
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        isSplitExact
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isSplitExact ? "✓ Allocated 100%" : `Remaining: Rs. ${money(splitRemaining)}`}
                    </span>
                  </div>
                </div>

                {/* Split Rows */}
                <div className="space-y-2">
                  {splitRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[120px_1fr_1fr_32px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5"
                    >
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400">
                          Payment #{idx + 1}
                        </label>
                        <select
                          value={row.kind}
                          onChange={(e) => {
                            const next = [...splitRows];
                            next[idx] = { ...row, kind: e.target.value as PosPaymentKind };
                            setSplitRows(next);
                          }}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white p-1 text-xs font-bold text-slate-800"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank</option>
                          <option value="jazzcash">JazzCash</option>
                          <option value="easypaisa">Easypaisa</option>
                          <option value="sadapay">SadaPay</option>
                          <option value="qr">QR Code</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400">
                          Amount (Rs.)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={row.amount}
                          onChange={(e) => {
                            const next = [...splitRows];
                            next[idx] = { ...row, amount: e.target.value };
                            setSplitRows(next);
                          }}
                          placeholder="0.00"
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white p-1 text-right text-xs font-black text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400">
                          Reference / Note
                        </label>
                        <input
                          type="text"
                          value={row.reference}
                          onChange={(e) => {
                            const next = [...splitRows];
                            next[idx] = { ...row, reference: e.target.value };
                            setSplitRows(next);
                          }}
                          placeholder="Optional"
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white p-1 text-xs text-slate-800"
                        />
                      </div>

                      <div className="flex justify-center pt-3">
                        {splitRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setSplitRows(splitRows.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-600"
                            title="Remove payment row"
                          >
                            <i className="fa-solid fa-trash-can text-xs" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, splitRemaining);
                      setSplitRows([...splitRows, newSplitRow("card", rem > 0 ? String(rem) : "")]);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    <i className="fa-solid fa-plus text-[10px]" />
                    <span>+ Add Payment Method</span>
                  </button>

                  <div className="text-right text-xs">
                    <span className="text-slate-500">Allocated: </span>
                    <span className="font-black text-slate-900">Rs. {money(totalSplitAllocated)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                G. PARTIAL PAYMENT FORM
               ======================================================== */}
            {selectedCategory === "partial" && (
              <div className="space-y-3 rounded-2xl border border-teal-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Invoice Amount
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                    <i className="fa-solid fa-calculator" />
                    <span>Partial Settlement</span>
                  </span>
                </div>

                {!customer.id ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                      <i className="fa-solid fa-triangle-exclamation text-base" />
                    </div>
                    <p className="text-xs font-bold text-amber-900">
                      Customer is required for Partial Payments to record remaining balance due.
                    </p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                    >
                      + Select or Create Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Amount Paid Today (Rs.)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={totals.grand}
                          value={partialPaidAmount || ""}
                          onChange={(e) => setPartialPaidAmount(Number(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-black text-slate-900 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Payment Tender Used
                        </label>
                        <select
                          value={partialMethod}
                          onChange={(e) => setPartialMethod(e.target.value as PosPaymentKind)}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card POS</option>
                          <option value="bank">Bank Transfer</option>
                          <option value="jazzcash">JazzCash</option>
                          <option value="easypaisa">Easypaisa</option>
                        </select>
                      </div>
                    </div>

                    {/* Breakdown of Partial + Ledger */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Paid Today</span>
                        <span className="text-base font-black text-emerald-700">Rs. {money(partialPaidAmount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Remaining Due</span>
                        <span className="text-base font-black text-amber-700">Rs. {money(partialBalanceDue)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">New Total Udhaar</span>
                        <span className="text-base font-black text-slate-900">Rs. {money(partialNewUdhaar)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================
                H. CREDIT / UDHAAR FORM
               ======================================================== */}
            {selectedCategory === "credit" && (
              <div className="space-y-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount Due
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                    <i className="fa-solid fa-book-bookmark" />
                    <span>Udhaar Sale</span>
                  </span>
                </div>

                {!customer.id ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                      <i className="fa-solid fa-triangle-exclamation text-base" />
                    </div>
                    <p className="text-xs font-bold text-amber-900">
                      Customer is required for Credit / Udhaar sales
                    </p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                    >
                      + Select or Create Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Current Udhaar</span>
                        <span className="text-base font-black text-amber-700">{money(customer.outstanding)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Credit Limit</span>
                        <span className="text-base font-bold text-slate-800">{money(customer.creditLimit)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">New Total Balance</span>
                        <span className="text-base font-black text-slate-900">{money(newUdhaarBalance)}</span>
                      </div>
                    </div>

                    {isCreditOverLimit ? (
                      <p className="rounded-lg bg-red-100 p-2 text-xs font-bold text-red-700">
                        Warning: Sale exceeds customer's credit limit by Rs. {money(newUdhaarBalance - customer.creditLimit)}.
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 font-medium">
                        ✓ Credit available: Rs. {money(creditHeadroom)} remaining limit.
                      </p>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Optional Cash Down Payment Paid Today
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={totals.grand}
                        value={creditDownPayment || ""}
                        onChange={(e) => setCreditDownPayment(Number(e.target.value) || 0)}
                        placeholder="0.00 (Full amount to Udhaar)"
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-right font-bold text-slate-900 focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================
                I. INSTALLMENT PLAN FORM
               ======================================================== */}
            {selectedCategory === "installment" && (
              <div className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Invoice Amount
                    </span>
                    <p className="text-xl font-black text-slate-900">Rs. {money(totals.grand)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                    <i className="fa-solid fa-calendar-days" />
                    <span>Installment Plan</span>
                  </span>
                </div>

                {!customer.id ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                      <i className="fa-solid fa-triangle-exclamation text-base" />
                    </div>
                    <p className="text-xs font-bold text-amber-900">
                      Customer is required for Installment Plan sales.
                    </p>
                    <button
                      type="button"
                      onClick={onSelectCustomer}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                    >
                      + Select or Create Customer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Down Payment (Rs.)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={totals.grand}
                          value={installmentDownPayment || ""}
                          onChange={(e) => setInstallmentDownPayment(Number(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-black text-slate-900 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Installment Tenure
                        </label>
                        <select
                          value={installmentCount}
                          onChange={(e) => setInstallmentCount(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800"
                        >
                          <option value={3}>3 Months Plan</option>
                          <option value={6}>6 Months Plan</option>
                          <option value={12}>12 Months Plan</option>
                          <option value={18}>18 Months Plan</option>
                          <option value={24}>24 Months Plan</option>
                        </select>
                      </div>
                    </div>

                    {/* Installment Summary Box */}
                    <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-xs space-y-1 text-violet-950">
                      <div className="flex justify-between">
                        <span>Financed Principal:</span>
                        <span className="font-bold">Rs. {money(installmentPrincipal)}</span>
                      </div>
                      <div className="flex justify-between font-black text-sm text-violet-900 border-t border-violet-200/60 pt-1">
                        <span>Monthly Installment:</span>
                        <span>Rs. {money(monthlyInstallment)} / mo</span>
                      </div>
                      <p className="text-[10px] text-violet-700 pt-0.5">
                        * Monthly schedule automatically created for {customer.label}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. DOMINANT CONFIRM PAYMENT ACTION FOOTER */}
          <div className="pos-zone-footer shrink-0 border-t border-slate-200 bg-white p-3 shadow-lg sm:p-4">
            {paymentFlowState === "processing" ? (
              <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">
                <i className="fa-solid fa-spinner fa-spin" />
                Processing payment… Please wait.
              </div>
            ) : null}
            {paymentFlowState === "failed" ? (
              <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-800">
                <i className="fa-solid fa-circle-xmark" />
                Payment failed. Adjust tender and try again.
              </div>
            ) : null}

            <button
              type="button"
              disabled={busy || lines.length === 0 || paymentFlowState === "processing"}
              onClick={handleCompleteClick}
              className={`flex w-full items-center justify-between rounded-2xl px-5 py-4 text-base font-black text-white shadow-md transition active:scale-99 disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedCategory === "cash" && isCashShort
                  ? "bg-red-600 hover:bg-red-700"
                  : selectedCategory === "split" && !isSplitExact
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-lock"} text-xl`} />
                <span>{busy ? "Processing…" : "PAY & COMPLETE SALE"}</span>
              </span>

              <span className="rounded-xl bg-black/20 px-3 py-1 text-sm font-black">
                {selectedCategory === "cash" && isCashShort
                  ? `Short: Rs. ${money(balanceRemaining)}`
                  : `Rs. ${money(totals.grand)}`}
              </span>
            </button>

            <p className="mt-2 text-center text-[10px] text-slate-400">
              Payment is recorded only after confirmation succeeds · <span className="font-bold text-slate-600">Esc</span> to return to cart
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
