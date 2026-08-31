import { useEffect, useState, type FormEvent } from "react";
import { Breadcrumb, Button, Card, Form, FormActions, Input, PageHeader, Select, useToast } from "@electronic-erp/ui";
import { catalogApi } from "./catalog-api";

export function UnitsPage() {
  const toast = useToast();
  const [units, setUnits] = useState<Array<Record<string, unknown>>>([]);
  const [conversions, setConversions] = useState<Array<Record<string, unknown>>>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbolPlaces, setSymbolPlaces] = useState("0");
  const [fromUnitId, setFromUnitId] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [factor, setFactor] = useState("1");
  const [productId, setProductId] = useState("");

  async function refresh() {
    const [u, c] = await Promise.all([catalogApi.listTaxonomy("units"), catalogApi.listConversions()]);
    setUnits(u.items);
    setConversions(c.items);
  }

  useEffect(() => {
    void refresh().catch((err: unknown) =>
      toast.push({
        title: "Failed to load units",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  const unitOptions = units.map((u) => ({ value: String(u.id), label: `${u.code} — ${u.name}` }));

  async function createUnit(e: FormEvent) {
    e.preventDefault();
    await catalogApi.createUnit({ code, name, symbolPlaces: Number(symbolPlaces) });
    setCode("");
    setName("");
    toast.push({ title: "Unit created", tone: "success" });
    await refresh();
  }

  async function createConversion(e: FormEvent) {
    e.preventDefault();
    await catalogApi.createConversion({
      fromUnitId,
      toUnitId,
      factor,
      productId: productId || undefined,
    });
    toast.push({ title: "Conversion saved", tone: "success" });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Products", href: "/products" },
          { label: "Units of Measurement" },
        ]}
      />

      <PageHeader
        moduleNumber="02"
        title="Units of Measurement & Conversions"
        description="Configure standard inventory units (Pieces, Box, Carton, Meter, Kg) and multi-tier conversion ratios."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Create Unit Card */}
        <Card title="Add Unit of Measurement" description="Define atomic units used across sales, stock, and purchasing." divided>
          <Form onSubmit={createUnit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Unit Code / Symbol"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. PCS, CTN, MTR"
                required
              />
              <Input
                label="Unit Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pieces, Carton, Meter"
                required
              />
            </div>
            <Input
              label="Decimal Precision Places"
              type="number"
              min={0}
              max={4}
              value={symbolPlaces}
              onChange={(e) => setSymbolPlaces(e.target.value)}
              placeholder="0 (for discrete units) or 2"
            />
            <FormActions>
              <Button type="submit">Create Unit</Button>
            </FormActions>
          </Form>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Configured Units ({units.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {units.map((u) => (
                <div key={String(u.id)} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <p className="font-bold text-slate-900">{String(u.name)}</p>
                  <p className="font-mono text-[11px] text-blue-600">{String(u.code)}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Create Conversion Card */}
        <Card title="Add Unit Conversion Rule" description="Example: 1 Carton = 24 Pieces" divided>
          <Form onSubmit={createConversion} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="From Unit (Larger)"
                value={fromUnitId}
                onChange={(e) => setFromUnitId(e.target.value)}
                options={[{ value: "", label: "Select unit" }, ...unitOptions]}
                required
              />
              <Select
                label="To Unit (Base)"
                value={toUnitId}
                onChange={(e) => setToUnitId(e.target.value)}
                options={[{ value: "", label: "Select unit" }, ...unitOptions]}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Conversion Factor"
                type="number"
                step="any"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                placeholder="e.g. 12 or 24"
                required
              />
              <Input
                label="Product ID (Optional Override)"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="Leave blank for global rule"
              />
            </div>
            <FormActions>
              <Button type="submit">Save Conversion Rule</Button>
            </FormActions>
          </Form>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Active Conversion Rules</h4>
            <div className="space-y-1.5">
              {conversions.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800">
                    {String(c.from_unit_code || c.from_unit_id)} → {String(c.to_unit_code || c.to_unit_id)}
                  </span>
                  <span className="font-mono font-bold text-emerald-700">× {String(c.factor)}</span>
                </div>
              ))}
              {conversions.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No conversion rules configured yet.</p>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
