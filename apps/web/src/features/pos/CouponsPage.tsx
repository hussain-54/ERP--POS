import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import {
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSelect,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

type CouponRow = {
  id: string;
  code: string;
  name: string | null;
  discountMode: string;
  discountValue: number;
  minPurchase: number;
  usageCount: number;
  usageLimit: number | null;
  isActive: boolean;
};

export function CouponsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canConfigure = hasPermission("pos.configure");
  const canView = canConfigure || hasPermission("pos.sell");
  const [items, setItems] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    discountMode: "percentage" as "percentage" | "fixed",
    discountValue: "10",
    minPurchase: "0",
    usageLimit: "",
  });

  async function load() {
    if (!canView) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await posApi.listCoupons();
      setItems(res.items as CouponRow[]);
    } catch (err) {
      toast.push({
        title: "Coupons failed to load",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canConfigure) return;
    setBusy(true);
    try {
      await posApi.createCoupon({
        code: form.code,
        name: form.name || undefined,
        discountMode: form.discountMode,
        discountValue: Number(form.discountValue),
        minPurchase: Number(form.minPurchase || 0),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      });
      toast.push({ title: "Coupon created", tone: "success" });
      setForm({
        code: "",
        name: "",
        discountMode: "percentage",
        discountValue: "10",
        minPurchase: "0",
        usageLimit: "",
      });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb items={[{ label: "Home", to: "/" }, { label: "POS / Sales", to: "/pos" }, { label: "Coupons" }]} />
      <POSPageHeader
        title="Coupons"
        subtitle="Validated coupon codes apply through the existing invoice-discount / sale-totals engine."
      />
      {!canView ? (
        <POSEmptyState title="Coupons unavailable" description="Requires pos.sell or pos.configure." />
      ) : loading ? (
        <POSLoadingState label="Loading coupons…" />
      ) : (
        <>
          {canConfigure ? (
            <POSCard padding="sm" title="Create coupon">
              <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => void onCreate(e)}>
                <POSInput
                  label="Code"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
                <POSInput
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <POSSelect
                  label="Mode"
                  value={form.discountMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountMode: e.target.value as "percentage" | "fixed",
                    }))
                  }
                  options={[
                    { value: "percentage", label: "Percentage" },
                    { value: "fixed", label: "Fixed amount" },
                  ]}
                />
                <POSInput
                  label="Value"
                  required
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                />
                <POSInput
                  label="Min purchase"
                  value={form.minPurchase}
                  onChange={(e) => setForm((f) => ({ ...f, minPurchase: e.target.value }))}
                />
                <POSInput
                  label="Usage limit"
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                  hint="Leave blank for unlimited"
                />
                <div className="sm:col-span-3">
                  <POSButton type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Create coupon"}
                  </POSButton>
                </div>
              </form>
            </POSCard>
          ) : null}
          <POSCard padding="sm" title="Active coupons">
            {!items.length ? (
              <POSEmptyState title="No coupons yet" description="Create a coupon to redeem on POS Terminal." />
            ) : (
              <POSTable>
                <POSTableHead>
                  <tr>
                    <POSTh>Code</POSTh>
                    <POSTh>Mode</POSTh>
                    <POSTh>Value</POSTh>
                    <POSTh>Min</POSTh>
                    <POSTh>Used</POSTh>
                    <POSTh>Status</POSTh>
                  </tr>
                </POSTableHead>
                <POSTableBody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <POSTd>{row.code}</POSTd>
                      <POSTd>{row.discountMode}</POSTd>
                      <POSTd>{row.discountValue}</POSTd>
                      <POSTd>{row.minPurchase}</POSTd>
                      <POSTd>
                        {row.usageCount}
                        {row.usageLimit != null ? ` / ${row.usageLimit}` : ""}
                      </POSTd>
                      <POSTd>{row.isActive ? "Active" : "Inactive"}</POSTd>
                    </tr>
                  ))}
                </POSTableBody>
              </POSTable>
            )}
          </POSCard>
        </>
      )}
    </div>
  );
}
