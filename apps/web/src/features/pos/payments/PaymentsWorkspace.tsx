import { Link, useNavigate } from "react-router-dom";
import { PosSubPageShell } from "../PosSubPageShell";import type { PosPaymentKind } from "../types";
import { PAYMENT_METHODS } from "../types";

export type PaymentsWorkspaceMode = PosPaymentKind | "refund";

const REFUND_META = {
  title: "Refund",
  description: "Process payment refunds against posted sales.",
};

export function PaymentsWorkspace({ mode }: { mode: PaymentsWorkspaceMode }) {
  const navigate = useNavigate();

  if (mode === "refund") {
    return (
      <PosSubPageShell moduleNumber="06" moduleLabel="Payments" title={REFUND_META.title} description={REFUND_META.description}>
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Payment refunds are posted through the Returns workflow — real sale_return records with cash, bank, or store
            credit settlement via existing APIs.
          </p>
          <button
            type="button"
            onClick={() => navigate("/pos/returns/cash-refund")}
            className="w-full rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white"
          >
            Open cash refund return
          </button>
          <Link to="/pos/returns" className="block text-center text-xs font-semibold text-[var(--pos-primary)]">
            All return options
          </Link>
        </div>
      </PosSubPageShell>
    );
  }

  const method = PAYMENT_METHODS.find((m) => m.id === mode);
  const title = method?.label ?? mode;

  return (
    <PosSubPageShell
      moduleNumber="06"
      moduleLabel="Payments"
      title={title}
      description={`Record ${title.toLowerCase()} tender on the active sale. Cart is preserved while configuring payment.`}
      actions={
        <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
          New Sale
        </Link>
      }
    >
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {method?.recordOnly ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Record-only — reference and amount are stored on the sale; no live PSP integration in this build.
          </p>
        ) : null}
        <p className="text-sm text-slate-600">
          Open the sales terminal with this tender selected. Use Payment to record splits, partial pay, or change without
          losing the cart.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/pos/sales/new?pay=1&tender=${mode}`)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white"
        >
          {method ? <i className={`fa-solid ${method.icon}`} aria-hidden /> : null}
          Open terminal — {title}
        </button>
      </div>
    </PosSubPageShell>
  );
}
