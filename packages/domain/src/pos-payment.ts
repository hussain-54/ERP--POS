import {
  addDecimal,
  compareDecimal,
  subtractDecimal,
  type PaymentMethodKind,
} from "@electronic-erp/contracts";
import { evaluateCredit, type CreditCheckResult } from "./credit.js";
import { ValidationDomainError } from "./errors.js";
import { roundMoney, finiteMoney } from "./money.js";
import { assertSplitMatchesBill, sumSplits, type SplitLine } from "./split-payment.js";

/** How the cashier intends to settle the bill. */
export type PosPaymentType = "full" | "partial" | "split" | "advance" | "credit" | "installment" | "cash";

export type PosPaymentConfirmationStatus = "pending" | "success" | "failure" | "retry";

export type PosPaymentLineInput = {
  paymentMethodId: string;
  kind?: PaymentMethodKind | string;
  /** Amount applied toward the bill (or tendered for cash before normalization). */
  amount: number | string;
  /**
   * Cash tendered (amount received). When set and > applied, change is computed.
   * For pure cash full pay, amount may equal tendered; preparePosPayments normalizes.
   */
  amountReceived?: number | string | null;
  reference?: string;
};

export type PosPaymentPreparation = {
  paymentType: PosPaymentType;
  /** Splits to post (applied to bill; never includes change). */
  splits: SplitLine[];
  paidTowardBill: number;
  remaining: number;
  change: number;
  amountReceived: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  confirmation: PosPaymentConfirmationStatus;
  errors: string[];
  ok: boolean;
};

function money(v: unknown): number {
  return roundMoney(finiteMoney(v, 0));
}

function kindOf(line: PosPaymentLineInput): string {
  return String(line.kind ?? "").toLowerCase();
}

function isCreditLike(kind: string): boolean {
  return kind === "credit" || kind === "installment";
}

/**
 * Classify POS payment shape for UX / audit.
 * Priority: installment → advance → credit → cash (single) → split → partial → full.
 */
export function classifyPosPaymentType(input: {
  lines: PosPaymentLineInput[];
  grandTotal: number;
  paidTowardBill: number;
  useInstallment?: boolean;
  isAdvance?: boolean;
}): PosPaymentType {
  if (input.useInstallment) return "installment";
  if (input.isAdvance) return "advance";
  const active = input.lines.filter((l) => money(l.amount) > 0 || money(l.amountReceived) > 0);
  if (active.every((l) => isCreditLike(kindOf(l))) && input.paidTowardBill <= 0.009) return "credit";
  if (input.paidTowardBill + 0.009 < input.grandTotal && input.paidTowardBill > 0.009) return "partial";
  if (active.length > 1) return "split";
  if (active.length === 1 && kindOf(active[0]!) === "cash") return "cash";
  if (active.some((l) => isCreditLike(kindOf(l))) && input.paidTowardBill + 0.009 < input.grandTotal) {
    return "credit";
  }
  return "full";
}

/** Cash: amount received + change (change never posts as payment). */
export function resolveCashTender(input: {
  grandTotal: number;
  amountReceived: number;
  /** Optional explicit amount to apply; defaults to min(received, grand). */
  applyAmount?: number;
}): { applied: number; change: number; amountReceived: number } {
  const grand = money(input.grandTotal);
  const received = money(input.amountReceived);
  if (received < 0) throw new ValidationDomainError("Amount received cannot be negative");
  const applied = money(
    input.applyAmount != null ? Math.min(money(input.applyAmount), grand, received || grand) : Math.min(received, grand),
  );
  if (received > 0 && applied > received + 1e-9) {
    throw new ValidationDomainError("Applied cash cannot exceed amount received");
  }
  const change = money(Math.max(0, received - applied));
  return { applied, change, amountReceived: received };
}

/**
 * Normalize UI payment lines into posting splits + settlement totals.
 * Over-tendered cash becomes change; split amounts must reconcile to paidTowardBill.
 */
export function preparePosPayments(input: {
  grandTotal: number;
  lines: PosPaymentLineInput[];
  walkIn: boolean;
  hasCustomer: boolean;
  allowCreditDue: boolean;
  useInstallment?: boolean;
  isAdvance?: boolean;
  /** When true, unpaid remainder is OK (credit / installment). */
  allowRemaining?: boolean;
}): PosPaymentPreparation {
  const grand = money(input.grandTotal);
  const errors: string[] = [];
  if (!(grand > 0)) {
    return {
      paymentType: "full",
      splits: [],
      paidTowardBill: 0,
      remaining: 0,
      change: 0,
      amountReceived: 0,
      paymentStatus: "unpaid",
      confirmation: "failure",
      errors: ["Grand total must be positive"],
      ok: false,
    };
  }

  let change = 0;
  let amountReceived = 0;
  const splits: SplitLine[] = [];

  for (const line of input.lines) {
    const kind = kindOf(line);
    const rawAmount = money(line.amount);
    const received = line.amountReceived != null ? money(line.amountReceived) : null;

    if (kind === "cash") {
      const tendered =
        received != null && received > 0
          ? received
          : rawAmount > grand
            ? rawAmount
            : null;
      if (tendered != null) {
        const tender = resolveCashTender({
          grandTotal: grand,
          amountReceived: tendered,
          applyAmount: received != null && rawAmount > 0 && rawAmount <= grand ? rawAmount : undefined,
        });
        amountReceived = money(amountReceived + tender.amountReceived);
        change = money(change + tender.change);
        if (tender.applied > 0) {
          splits.push({
            paymentMethodId: line.paymentMethodId,
            kind: kind as PaymentMethodKind,
            amount: String(tender.applied),
            reference:
              line.reference ??
              (tender.change > 0
                ? `Cash received ${tender.amountReceived.toFixed(2)}; change ${tender.change.toFixed(2)}`
                : undefined),
          });
        }
        continue;
      }
    }

    if (rawAmount <= 0) continue;
    if (isCreditLike(kind)) {
      // Credit/installment method rows are informational for settlement type;
      // they do not reduce paidTowardBill (AR remains).
      continue;
    }

    splits.push({
      paymentMethodId: line.paymentMethodId,
      kind: (kind || undefined) as PaymentMethodKind | undefined,
      amount: String(rawAmount),
      reference: line.reference,
    });
  }

  // Cap applied total to grand (defensive — change already peeled for cash).
  let paidTowardBill = money(Number(sumSplits(splits)));
  if (paidTowardBill - grand > 0.009) {
    // Scale last non-cash overage into change metadata rather than posting overpayment.
    const overflow = money(paidTowardBill - grand);
    change = money(change + overflow);
    // Rebuild by reducing from end
    let need = grand;
    const capped: SplitLine[] = [];
    for (const s of splits) {
      if (need <= 0) break;
      const amt = money(Number(s.amount));
      const take = money(Math.min(amt, need));
      if (take > 0) {
        capped.push({ ...s, amount: String(take) });
        need = money(need - take);
      }
    }
    splits.length = 0;
    splits.push(...capped);
    paidTowardBill = money(Number(sumSplits(splits)));
  }

  const remaining = money(Math.max(0, grand - paidTowardBill));
  const allowRemaining = Boolean(input.allowRemaining ?? input.allowCreditDue ?? input.useInstallment);

  if (input.walkIn && remaining > 0.009) {
    errors.push("Walk-in sales must be paid in full");
  }
  if (!input.walkIn && !input.hasCustomer && remaining > 0.009) {
    errors.push("Select a customer for partial / credit payment");
  }
  if (remaining > 0.009 && !allowRemaining) {
    errors.push("Payment is less than grand total");
  }
  if (paidTowardBill <= 0 && remaining > 0.009 && !allowRemaining) {
    errors.push("Enter payment amount or select customer for credit");
  }
  if (splits.length > 1) {
    try {
      assertSplitMatchesBill(splits, String(paidTowardBill));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Split amounts do not reconcile");
    }
  }

  const paymentStatus: "unpaid" | "partial" | "paid" =
    paidTowardBill <= 0 ? "unpaid" : remaining <= 0.009 ? "paid" : "partial";

  const paymentType = classifyPosPaymentType({
    lines: input.lines,
    grandTotal: grand,
    paidTowardBill,
    useInstallment: input.useInstallment,
    isAdvance: input.isAdvance,
  });

  return {
    paymentType,
    splits,
    paidTowardBill,
    remaining,
    change,
    amountReceived,
    paymentStatus,
    confirmation: errors.length ? "failure" : "pending",
    errors,
    ok: errors.length === 0,
  };
}

export function assertPosPaymentPrepared(prep: PosPaymentPreparation): void {
  if (!prep.ok) {
    throw new ValidationDomainError(prep.errors[0] ?? "Payment validation failed");
  }
}

/** Credit/udhar validation for remaining balance after cash/bank portions. */
export function validatePosCreditPayment(input: {
  creditLimit: string;
  outstanding: string;
  creditDays: number;
  isBlocked: boolean;
  additionalCredit: string;
  hasApproval: boolean;
}): CreditCheckResult {
  const result = evaluateCredit({
    creditLimit: input.creditLimit,
    outstanding: input.outstanding,
    additionalCredit: input.additionalCredit,
    creditDays: input.creditDays,
    isBlocked: input.isBlocked,
  });
  if (result.reason === "Customer is blocked") {
    throw new ValidationDomainError(result.reason);
  }
  if (result.requiresApproval && !input.hasApproval) {
    throw new ValidationDomainError("Credit approval required: limit exceeded");
  }
  return result;
}

export type PaymentAttemptState = {
  idempotencyKey: string;
  status: PosPaymentConfirmationStatus;
  lastError?: string;
  submittedAt?: string;
  completedAt?: string;
};

/** In-memory attempt gate — prevents duplicate submission for the same key. */
export class PaymentAttemptGate {
  private readonly attempts = new Map<string, PaymentAttemptState>();

  begin(idempotencyKey: string): PaymentAttemptState {
    const existing = this.attempts.get(idempotencyKey);
    if (existing?.status === "pending") {
      throw new ValidationDomainError("Payment already in progress — avoid duplicate submission");
    }
    if (existing?.status === "success") {
      return existing;
    }
    const next: PaymentAttemptState = {
      idempotencyKey,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    this.attempts.set(idempotencyKey, next);
    return next;
  }

  succeed(idempotencyKey: string): PaymentAttemptState {
    const next: PaymentAttemptState = {
      idempotencyKey,
      status: "success",
      submittedAt: this.attempts.get(idempotencyKey)?.submittedAt,
      completedAt: new Date().toISOString(),
    };
    this.attempts.set(idempotencyKey, next);
    return next;
  }

  fail(idempotencyKey: string, error: string): PaymentAttemptState {
    const next: PaymentAttemptState = {
      idempotencyKey,
      status: "failure",
      lastError: error,
      submittedAt: this.attempts.get(idempotencyKey)?.submittedAt,
      completedAt: new Date().toISOString(),
    };
    this.attempts.set(idempotencyKey, next);
    return next;
  }

  /** Mark for retry with the same checkout key after failure. */
  retry(idempotencyKey: string): PaymentAttemptState {
    const prev = this.attempts.get(idempotencyKey);
    const next: PaymentAttemptState = {
      idempotencyKey,
      status: "retry",
      lastError: prev?.lastError,
      submittedAt: prev?.submittedAt,
    };
    this.attempts.set(idempotencyKey, next);
    return next;
  }

  get(idempotencyKey: string): PaymentAttemptState | undefined {
    return this.attempts.get(idempotencyKey);
  }
}

export function decimalDiff(a: string, b: string): string {
  return subtractDecimal(a, b);
}

export function decimalSum(values: string[]): string {
  return values.reduce((acc, v) => addDecimal(acc, v), "0");
}

export function decimalsEqual(a: string, b: string): boolean {
  return compareDecimal(a, b) === 0;
}

/**
 * Split posted tenders for the sale journal.
 * Cash → Cash (1000). Bank + record-only card/wallets → Bank (1010).
 * Missing kind defaults to cash (legacy POS payloads).
 */
export function classifySaleSettlement(
  splits: Array<{ amount: string | number; kind?: string | null }>,
): { paidCash: number; paidBank: number } {
  let paidCash = 0;
  let paidBank = 0;
  for (const split of splits) {
    const amount = money(split.amount);
    if (!(amount > 0)) continue;
    const kind = String(split.kind ?? "").toLowerCase();
    if (!kind || kind === "cash") paidCash = money(paidCash + amount);
    else paidBank = money(paidBank + amount);
  }
  return { paidCash, paidBank };
}

export type CheckoutIdempotencyEvent = "posted" | "failed" | "retry" | "new-sale";

/**
 * Keep the checkout UUID on failure/retry so a lost response cannot create a second sale.
 * Rotate only after a confirmed posted sale or an explicit new sale.
 */
export function resolveCheckoutIdempotencyKey(input: {
  currentKey: string;
  event: CheckoutIdempotencyEvent;
}): { rotate: true } | { keep: string } {
  if (input.event === "posted" || input.event === "new-sale") return { rotate: true };
  return { keep: input.currentKey };
}
