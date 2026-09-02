import type { ApproverRole } from "@electronic-erp/contracts";
import { ApplyDiscountPanel } from "../pricing/ApplyDiscountPanel";
import type { DiscountSection } from "../pricing/discount-utils";
import type { CartLine, DiscountMode, PosCustomerView } from "../types";

export function DiscountDialog({
  open,
  scope,
  section = scope === "item" ? "item" : "invoice",
  line,
  invoiceBase,
  customer,
  actingRole,
  allowPriceOverride,
  organizationId,
  branchId,
  notes,
  onNotes,
  onClose,
  onApplyItem,
  onApplyInvoice,
  onApplyPriceOverride,
}: {
  open: boolean;
  scope: "item" | "invoice";
  section?: DiscountSection;
  line: CartLine | null;
  invoiceBase: number;
  customer: PosCustomerView;
  actingRole: ApproverRole;
  allowPriceOverride: boolean;
  organizationId: string | null;
  branchId: string | null;
  notes?: string;
  onNotes?: (notes: string) => void;
  onClose: () => void;
  onApplyItem: (lineId: string, amount: number, percent: number) => void;
  onApplyInvoice: (input: {
    mode: DiscountMode;
    amount: number;
    percent: number;
    reason: string;
    coupon?: string;
  }) => void;
  onApplyPriceOverride: (lineId: string, rate: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="pos-sale-drawer flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden bg-white shadow-xl"
        role="dialog"
        aria-modal
        aria-label="Apply discount"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pricing & discounts</p>
            <h2 className="text-base font-bold text-slate-900">Apply discount</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>
        <ApplyDiscountPanel
          section={section}
          line={line}
          invoiceBase={invoiceBase}
          customer={customer}
          actingRole={actingRole}
          allowPriceOverride={allowPriceOverride}
          organizationId={organizationId}
          branchId={branchId}
          notes={notes}
          onNotes={onNotes}
          onApplyItem={onApplyItem}
          onApplyInvoice={onApplyInvoice}
          onApplyPriceOverride={onApplyPriceOverride}
          onClose={onClose}
        />
      </aside>
    </div>
  );
}
