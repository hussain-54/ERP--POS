import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { PosSubPageShell } from "../PosSubPageShell";
import type { DiscountSection } from "./discount-utils";

export type PricingWorkspaceMode =
  | "check"
  | "override"
  | "discount"
  | "promotions"
  | "coupons"
  | "customer"
  | "approval";

const META: Record<PricingWorkspaceMode, { title: string; description: string; section?: DiscountSection }> = {
  check: {
    title: "Price check",
    description: "Look up catalog prices before adding to the cart.",
  },
  override: {
    title: "Price override",
    description: "Override line prices on the sales terminal (manager permission).",
    section: "override",
  },
  discount: {
    title: "Apply discount",
    description: "Item and invoice discounts with approval limits.",
    section: "invoice",
  },
  promotions: {
    title: "Promotions",
    description: "Apply promotional discounts on the active sale.",
    section: "promotion",
  },
  coupons: {
    title: "Coupons",
    description: "Validate and apply coupon codes server-side.",
    section: "coupon",
  },
  customer: {
    title: "Customer pricing",
    description: "Customer tier and contract pricing context.",
    section: "customer",
  },
  approval: {
    title: "Discount approval",
    description: "Your discount authority ladder for this terminal.",
    section: "approval",
  },
};

export function PricingWorkspace({ mode }: { mode: PricingWorkspaceMode }) {
  const meta = META[mode];
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canDiscount = hasPermission("pos.discount_cashier") || hasPermission("pos.discount_supervisor") || hasPermission("pos.discount_manager") || hasPermission("pos.discount_owner") || hasPermission("pos.discount_special");

  if (mode === "check") {
    return (
      <PosSubPageShell moduleNumber="05" moduleLabel="Pricing" title={meta.title} description={meta.description}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">Search products and view retail / wholesale / stock on the Products workspace.</p>
          <Link to="/pos/products" className="mt-4 inline-block rounded-xl bg-[var(--pos-primary)] px-4 py-2 text-xs font-bold text-white">
            Open product search
          </Link>
        </div>
      </PosSubPageShell>
    );
  }

  const section = meta.section ?? "invoice";
  const discountQuery = `discount=1&section=${section}`;

  return (
    <PosSubPageShell
      moduleNumber="05"
      moduleLabel="Pricing"
      title={meta.title}
      description={meta.description}
      actions={
        <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
          New Sale
        </Link>
      }
    >
      {!canDiscount && section !== "customer" && section !== "approval" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You need POS discount permissions to apply discounts.
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Discounts apply to the active cart on the sales terminal. Your cart stays intact while you configure pricing.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/pos/sales/new?${discountQuery}`)}
            className="w-full rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white"
          >
            Open terminal — {meta.title}
          </button>
          {section === "override" ? (
            <p className="text-[11px] text-slate-400">Select a cart line, then use the Price override section in the discount panel.</p>
          ) : null}
        </div>
      )}
    </PosSubPageShell>
  );
}
