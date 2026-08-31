import { useEffect, useState, type FormEvent } from "react";
import { Breadcrumb, Button, Card, Form, FormActions, Input, PageHeader, useToast } from "@electronic-erp/ui";
import { catalogApi } from "./catalog-api";

export function PricingPage() {
  const toast = useToast();
  const [levels, setLevels] = useState<Array<Record<string, unknown>>>([]);
  const [levelForm, setLevelForm] = useState({ code: "", name: "" });
  const [priceForm, setPriceForm] = useState({
    productId: "",
    unitId: "",
    amount: "",
    priceLevelId: "",
    customerId: "",
  });
  const [prices, setPrices] = useState<Array<Record<string, unknown>>>([]);

  async function loadLevels() {
    const res = await catalogApi.listPriceLevels();
    setLevels(res.items);
  }

  useEffect(() => {
    void loadLevels().catch((err: unknown) =>
      toast.push({
        title: "Failed to load price levels",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  async function createLevel(e: FormEvent) {
    e.preventDefault();
    try {
      await catalogApi.createPriceLevel(levelForm);
      setLevelForm({ code: "", name: "" });
      await loadLevels();
      toast.push({ title: "Price level created", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function saveCustomerPrice(e: FormEvent) {
    e.preventDefault();
    try {
      await catalogApi.setProductPrice(priceForm.productId, {
        unitId: priceForm.unitId,
        amount: Number(priceForm.amount),
        priceLevelId: priceForm.priceLevelId || undefined,
        customerId: priceForm.customerId || undefined,
      });
      const res = await catalogApi.listProductPrices(priceForm.productId);
      setPrices(res.items);
      toast.push({ title: "Price saved", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Price save failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Products", href: "/products" },
          { label: "Pricing & Price Levels" },
        ]}
      />

      <PageHeader
        moduleNumber="02"
        title="Price Levels & Overrides"
        description="Configure wholesale, retail, distributor price levels and customer-specific price lists. Base prices are managed directly in product records."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Add Price Level" description="Define tiered pricing categories for sales and distribution." divided>
          <Form onSubmit={createLevel} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Level Code"
                value={levelForm.code}
                onChange={(e) => setLevelForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. WHOLESALE_A"
                required
              />
              <Input
                label="Display Name"
                value={levelForm.name}
                onChange={(e) => setLevelForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tier A Wholesale"
                required
              />
            </div>
            <FormActions>
              <Button type="submit">Save Price Level</Button>
            </FormActions>
          </Form>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Existing Price Levels</h4>
            <div className="space-y-1">
              {levels.map((lvl) => (
                <div key={String(lvl.id)} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800">{String(lvl.name)}</span>
                  <span className="font-mono text-slate-500">{String(lvl.code)}</span>
                </div>
              ))}
              {levels.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No custom price levels configured yet.</p>
              ) : null}
            </div>
          </div>
        </Card>

        <Card title="Customer / Product Specific Price" description="Set customized price overrides per customer or product unit." divided>
          <Form onSubmit={saveCustomerPrice} className="space-y-3">
            <Input
              label="Product ID"
              value={priceForm.productId}
              onChange={(e) => setPriceForm((f) => ({ ...f, productId: e.target.value }))}
              placeholder="UUID or product code"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Unit ID"
                value={priceForm.unitId}
                onChange={(e) => setPriceForm((f) => ({ ...f, unitId: e.target.value }))}
                placeholder="Unit UUID"
                required
              />
              <Input
                label="Override Amount (Rs.)"
                type="number"
                value={priceForm.amount}
                onChange={(e) => setPriceForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Price Level ID (Optional)"
                value={priceForm.priceLevelId}
                onChange={(e) => setPriceForm((f) => ({ ...f, priceLevelId: e.target.value }))}
                placeholder="Level UUID"
              />
              <Input
                label="Customer ID (Optional)"
                value={priceForm.customerId}
                onChange={(e) => setPriceForm((f) => ({ ...f, customerId: e.target.value }))}
                placeholder="Customer UUID"
              />
            </div>
            <FormActions>
              <Button type="submit">Save Override Price</Button>
            </FormActions>
          </Form>

          {prices.length ? (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Saved Product Prices</h4>
              {prices.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800">Rs. {String(p.amount)}</span>
                  <span className="text-slate-500 text-[11px]">{String(p.unitId)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
