import { memo } from "react";
import { POSButton, POSEmptyState } from "../design-system";
import {
  paymentMethodKind,
  paymentMethodLabel,
  paymentMethodSettlementNote,
  sortPosPaymentMethods,
  type PosPaymentMethod,
} from "../pos-payment-ux";

export type PaymentMethodGridProps = {
  methods: PosPaymentMethod[];
  selectedId: string | null;
  onSelect: (method: PosPaymentMethod) => void;
  disabled?: boolean;
  creditAllowed?: boolean;
  installmentAllowed?: boolean;
};

export const PaymentMethodGrid = memo(function PaymentMethodGrid({
  methods,
  selectedId,
  onSelect,
  disabled,
  creditAllowed = true,
  installmentAllowed = true,
}: PaymentMethodGridProps) {
  const ordered = sortPosPaymentMethods(methods);
  if (!ordered.length) {
    return (
      <POSEmptyState
        title="No payment methods configured"
        description="Ask an administrator to seed payment methods. Unsupported wallets are not invented here."
      />
    );
  }

  return (
    <div className="pos-pay-method-grid" role="group" aria-label="Payment methods">
      {ordered.map((method) => {
        const kind = paymentMethodKind(method);
        const selected = method.id === selectedId;
        const blockedCredit = kind === "credit" && !creditAllowed;
        const blockedInstallment = kind === "installment" && !installmentAllowed;
        const blocked = Boolean(disabled || blockedCredit || blockedInstallment);
        const note = paymentMethodSettlementNote(kind);
        const title = blockedCredit
          ? "Select a customer for credit / udhar"
          : blockedInstallment
            ? "Installment requires a customer and installments.manage"
            : (note ?? paymentMethodLabel(method));
        return (
          <POSButton
            key={method.id}
            size="sm"
            variant={selected ? "primary" : "secondary"}
            aria-pressed={selected}
            disabled={blocked}
            title={title}
            onClick={() => onSelect(method)}
          >
            {paymentMethodLabel(method)}
          </POSButton>
        );
      })}
    </div>
  );
});
