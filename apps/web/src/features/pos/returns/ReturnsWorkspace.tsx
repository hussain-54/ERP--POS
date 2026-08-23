import { useLocation } from "react-router-dom";
import { PosSubPageShell } from "../PosSubPageShell";
import { ReturnWorkflow } from "./ReturnWorkflow";
import {
  RETURN_REASON_CODES,
  reasonLabel,
  type ReturnWorkspaceMode,
} from "./return-utils";

const META: Record<
  Exclude<ReturnWorkspaceMode, "reasons">,
  { title: string; description: string }
> = {
  sales: {
    title: "Sales return",
    description: "Find the original sale, select lines, and post a return with real stock and refund settlement.",
  },
  "by-invoice": {
    title: "Return by invoice",
    description: "Search by invoice number or customer, then return all or part of the sale.",
  },
  "by-barcode": {
    title: "Return by barcode",
    description: "Scan a product barcode to locate the original sale and return matching lines.",
  },
  partial: {
    title: "Partial return",
    description: "Return selected quantities — scope is inferred as partial by the server.",
  },
  full: {
    title: "Full return",
    description: "Return all remaining quantities on the invoice in one step.",
  },
  exchange: {
    title: "Exchange",
    description: "Return original items and issue replacement stock through the exchange return API.",
  },
  "cash-refund": {
    title: "Cash refund",
    description: "Refund the customer in cash — recorded on the sale return, not a live PSP.",
  },
  "store-credit": {
    title: "Store credit",
    description: "Issue customer ledger credit instead of cash (requires customer on sale).",
  },
};

export function ReturnsWorkspace({ mode }: { mode: ReturnWorkspaceMode }) {
  const location = useLocation();
  const state = location.state as { saleId?: string; mode?: string } | null;

  if (mode === "reasons") {
    return (
      <PosSubPageShell
        moduleNumber="08"
        moduleLabel="Returns & Exchange"
        title="Return reasons"
        description="Standard reason codes used when posting sale returns."
      >
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase text-slate-400">
              <tr>
                <th className="pb-2">Code</th>
                <th className="pb-2">Label</th>
              </tr>
            </thead>
            <tbody>
              {RETURN_REASON_CODES.map((code) => (
                <tr key={code} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs text-slate-500">{code}</td>
                  <td className="py-2 font-semibold text-slate-800">{reasonLabel(code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-500">
            Reason codes are validated server-side via prepareSaleReturn. Choose Other and add notes when none of the
            standard reasons apply.
          </p>
        </div>
      </PosSubPageShell>
    );
  }

  const meta = META[mode];
  const initialRefund = state?.mode === "refund" || mode === "cash-refund";

  return (
    <PosSubPageShell
      moduleNumber="08"
      moduleLabel="Returns & Exchange"
      title={meta.title}
      description={meta.description}
    >
      <ReturnWorkflow mode={mode} initialSaleId={state?.saleId ?? null} initialRefund={initialRefund} />
    </PosSubPageShell>
  );
}
