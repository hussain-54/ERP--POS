import { Button, Card, Input, Select } from "@electronic-erp/ui";
import type { PaySplit } from "../pos-types";

interface Method {
  id: string;
  name: string;
  code?: string;
}

interface Props {
  totals: {
    items: number;
    qty: number;
    subtotal: number;
    discount: number;
    tax: number;
    grand: number;
  };
  invoiceDiscount: string;
  onInvoiceDiscount: (v: string) => void;
  canInvoiceDiscount: boolean;
  discountRef: React.RefObject<HTMLInputElement | null>;
  methods: Method[];
  payments: PaySplit[];
  onPayments: (p: PaySplit[]) => void;
  notes: string;
  onNotes: (v: string) => void;
  busy: boolean;
  canPay: boolean;
  /** When true, unpaid remainder is allowed (customer credit / udhaar). */
  allowCreditDue: boolean;
  onHold: () => void;
  onPay: () => void;
  onCancel: () => void;
  advanced: boolean;
  useInstallment: boolean;
  onUseInstallment: (v: boolean) => void;
  installmentCount: string;
  onInstallmentCount: (v: string) => void;
  downPayment: string;
  onDownPayment: (v: string) => void;
}

export function PosPaymentPanel({
  totals,
  invoiceDiscount,
  onInvoiceDiscount,
  canInvoiceDiscount,
  discountRef,
  methods,
  payments,
  onPayments,
  notes,
  onNotes,
  busy,
  canPay,
  allowCreditDue,
  onHold,
  onPay,
  onCancel,
  advanced,
  useInstallment,
  onUseInstallment,
  installmentCount,
  onInstallmentCount,
  downPayment,
  onDownPayment,
}: Props) {
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const due = Math.max(0, Math.round((totals.grand - paid) * 100) / 100);
  const change = Math.max(0, Math.round((paid - totals.grand) * 100) / 100);
  const defaultMethod = methods[0]?.id ?? "";
  const creditMethod = methods.find((m) => m.code === "credit" || /credit|udhaar/i.test(m.name));
  const payBlocked = busy || !canPay || (due > 0.009 && !allowCreditDue);

  function setAmount(id: string, amount: string) {
    onPayments(payments.map((p) => (p.id === id ? { ...p, amount } : p)));
  }

  function setMethod(id: string, paymentMethodId: string) {
    onPayments(payments.map((p) => (p.id === id ? { ...p, paymentMethodId } : p)));
  }

  function addSplit() {
    onPayments([
      ...payments,
      { id: crypto.randomUUID(), paymentMethodId: defaultMethod, amount: due > 0 ? String(due) : "" },
    ]);
  }

  function removeSplit(id: string) {
    if (payments.length <= 1) return;
    onPayments(payments.filter((p) => p.id !== id));
  }

  function quickPay(methodId: string) {
    onPayments([{ id: crypto.randomUUID(), paymentMethodId: methodId, amount: String(totals.grand) }]);
  }

  function chargeToCredit() {
    if (!creditMethod) return;
    onPayments([{ id: crypto.randomUUID(), paymentMethodId: creditMethod.id, amount: "0" }]);
  }

  return (
    <Card className="border-[var(--pos-border)] bg-[var(--pos-card)] p-3 shadow-sm">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Items / Qty</span>
          <span className="tabular-nums">
            {totals.items} / {totals.qty}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Discount</span>
          <span className="tabular-nums">−{totals.discount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Tax</span>
          <span className="tabular-nums">{totals.tax.toFixed(2)}</span>
        </div>
        <div className="flex items-end justify-between border-t border-[var(--pos-border)] pt-2">
          <span className="font-semibold">Grand Total</span>
          <span className="pos-grand tabular-nums">Rs {totals.grand.toFixed(2)}</span>
        </div>
      </div>

      {canInvoiceDiscount ? (
        <div className="mt-3">
          <Input
            ref={discountRef as React.RefObject<HTMLInputElement>}
            label="Invoice discount (F5)"
            type="number"
            value={invoiceDiscount}
            onChange={(e) => onInvoiceDiscount(e.target.value)}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1">
        {methods.slice(0, 5).map((m) => (
          <Button key={m.id} size="sm" variant="secondary" onClick={() => quickPay(m.id)} disabled={!totals.grand}>
            {m.name}
          </Button>
        ))}
        {allowCreditDue && creditMethod ? (
          <Button size="sm" variant="secondary" onClick={chargeToCredit} disabled={!totals.grand}>
            Full credit
          </Button>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="flex gap-2">
            <Select
              className="flex-1"
              value={p.paymentMethodId}
              onChange={(e) => setMethod(p.id, e.target.value)}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
              aria-label="Payment method"
            />
            <Input
              className="w-28"
              type="number"
              value={p.amount}
              onChange={(e) => setAmount(p.id, e.target.value)}
              aria-label="Amount"
            />
            {payments.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => removeSplit(p.id)} aria-label="Remove payment">
                ✕
              </Button>
            ) : null}
          </div>
        ))}
        {advanced ? (
          <Button size="sm" variant="secondary" onClick={addSplit}>
            + Split payment
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <div className="text-xs text-[var(--pos-muted)]">Paid</div>
          <div className="font-semibold tabular-nums">{paid.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <div className="text-xs text-[var(--pos-muted)]">{change > 0 ? "Change" : "Due / Credit"}</div>
          <div className={`font-semibold tabular-nums ${due > 0 ? "text-[var(--pos-danger)]" : ""}`}>
            {(change > 0 ? change : due).toFixed(2)}
          </div>
        </div>
      </div>

      {due > 0.009 && !allowCreditDue ? (
        <p className="mt-2 text-xs text-[var(--pos-danger)]">
          Walk-in must be paid in full. Select a customer to allow credit / partial.
        </p>
      ) : null}

      {advanced && allowCreditDue ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--pos-border)] p-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useInstallment}
              onChange={(e) => onUseInstallment(e.target.checked)}
            />
            Create installment plan
          </label>
          {useInstallment ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Down payment"
                type="number"
                value={downPayment}
                onChange={(e) => onDownPayment(e.target.value)}
              />
              <Input
                label="Installments"
                type="number"
                value={installmentCount}
                onChange={(e) => onInstallmentCount(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {advanced ? (
        <div className="mt-3">
          <Input label="Notes" value={notes} onChange={(e) => onNotes(e.target.value)} />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={onHold} disabled={busy || !canPay} title="F2 Hold">
          Hold
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy} title="F8 Cancel">
          Cancel
        </Button>
        <Button className="pos-cta border-0" onClick={onPay} disabled={payBlocked}>
          {busy ? "…" : due > 0.009 && allowCreditDue ? "Complete" : "Pay"}
        </Button>
      </div>
    </Card>
  );
}
