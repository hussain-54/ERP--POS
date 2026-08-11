import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
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
      <div>
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Price levels and customer-specific overrides. Product base prices live on the product form.
        </p>
      </div>

      <Card>
        <Form onSubmit={createLevel}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Level code"
              value={levelForm.code}
              onChange={(e) => setLevelForm((p) => ({ ...p, code: e.target.value }))}
              required
            />
            <Input
              label="Level name"
              value={levelForm.name}
              onChange={(e) => setLevelForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <FormActions>
            <Button type="submit">Add price level</Button>
          </FormActions>
        </Form>
        <ul className="mt-4 space-y-1 text-sm">
          {levels.map((l) => (
            <li key={String(l.id)}>
              {String(l.code)} — {String(l.name)}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Form onSubmit={saveCustomerPrice}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Product ID"
              value={priceForm.productId}
              onChange={(e) => setPriceForm((p) => ({ ...p, productId: e.target.value }))}
              required
            />
            <Input
              label="Unit ID"
              value={priceForm.unitId}
              onChange={(e) => setPriceForm((p) => ({ ...p, unitId: e.target.value }))}
              required
            />
            <Input
              label="Amount"
              value={priceForm.amount}
              onChange={(e) => setPriceForm((p) => ({ ...p, amount: e.target.value }))}
              required
            />
            <Input
              label="Price level ID (optional)"
              value={priceForm.priceLevelId}
              onChange={(e) => setPriceForm((p) => ({ ...p, priceLevelId: e.target.value }))}
            />
            <Input
              label="Customer ID (optional)"
              value={priceForm.customerId}
              onChange={(e) => setPriceForm((p) => ({ ...p, customerId: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit">Save customer / level price</Button>
          </FormActions>
        </Form>
        <ul className="mt-4 space-y-1 text-sm">
          {prices.map((p) => (
            <li key={String(p.id)}>
              {String(p.amount)}
              {p.customer_id ? ` · customer ${String(p.customer_id)}` : ""}
              {p.price_level_id ? ` · level ${String(p.price_level_id)}` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
