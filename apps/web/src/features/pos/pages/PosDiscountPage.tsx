import { Link } from "react-router-dom";

/** Standalone discount entry — opens the terminal discount flow. */
export function PosDiscountPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--pos-workspace)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/pos" className="pos-back-link">
          <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
          Back to POS Command Center
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Pricing & Discounts</h1>
        <p className="text-sm text-slate-500">
          Apply item or invoice discounts from the live sales terminal. Discounts respect your
          approval ladder (cashier → special).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/pos/sales/new?discount=1"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--pos-primary)]"
          >
            <h2 className="text-sm font-bold text-slate-900">Invoice discount</h2>
            <p className="mt-1 text-xs text-slate-500">Open New Sale with the discount panel.</p>
          </Link>
          <Link
            to="/pos/sales/new"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--pos-primary)]"
          >
            <h2 className="text-sm font-bold text-slate-900">Item discount</h2>
            <p className="mt-1 text-xs text-slate-500">Add items, then tap Disc on a cart line.</p>
          </Link>
          <Link
            to="/pos/pricing"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--pos-primary)]"
          >
            <h2 className="text-sm font-bold text-slate-900">Pricing hub</h2>
            <p className="mt-1 text-xs text-slate-500">All pricing & discount tools.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
