import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, Input, Select, useToast } from "@electronic-erp/ui";
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
  const [factor, setFactor] = useState("90");
  const [productId, setProductId] = useState("");
  const [attrCode, setAttrCode] = useState("");
  const [attrName, setAttrName] = useState("");

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Units & conversions</h1>
        <Button
          variant="secondary"
          onClick={() =>
            void catalogApi.seedUnits().then(() => {
              toast.push({ title: "System units seeded", tone: "success" });
              return refresh();
            })
          }
        >
          Seed system units
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Create unit">
          <Form onSubmit={(e) => void createUnit(e)}>
            <Input label="Code" required value={code} onChange={(e) => setCode(e.target.value)} />
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Decimal places"
              value={symbolPlaces}
              onChange={(e) => setSymbolPlaces(e.target.value)}
              hint="Supports 0.5, 1.25, 12.5 etc via NUMERIC storage"
            />
            <Button type="submit">Create unit</Button>
          </Form>
        </Card>

        <Card title="Unit conversion" description="Example: 1 Roll = 90 Meter">
          <Form onSubmit={(e) => void createConversion(e)}>
            <Select label="From unit" options={unitOptions} value={fromUnitId} onChange={(e) => setFromUnitId(e.target.value)} placeholder="Select" />
            <Select label="To unit" options={unitOptions} value={toUnitId} onChange={(e) => setToUnitId(e.target.value)} placeholder="Select" />
            <Input label="Factor" required value={factor} onChange={(e) => setFactor(e.target.value)} />
            <Input label="Product ID (optional)" value={productId} onChange={(e) => setProductId(e.target.value)} hint="Leave empty for org-wide rule" />
            <Button type="submit">Save conversion</Button>
          </Form>
        </Card>

        <Card title="Custom attribute">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void catalogApi
                .createAttribute({ code: attrCode, name: attrName, dataType: "text", options: [] })
                .then(() => {
                  toast.push({ title: "Attribute created", tone: "success" });
                  setAttrCode("");
                  setAttrName("");
                });
            }}
          >
            <Input label="Code" required value={attrCode} onChange={(e) => setAttrCode(e.target.value)} />
            <Input label="Name" required value={attrName} onChange={(e) => setAttrName(e.target.value)} />
            <Button type="submit">Create attribute</Button>
          </Form>
        </Card>
      </div>

      <Card title="Units">
        <ul className="space-y-1 text-sm">
          {units.map((u) => (
            <li key={String(u.id)}>
              {String(u.code)} — {String(u.name)} (dp: {String(u.symbol_places)})
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Conversions">
        <ul className="space-y-1 text-sm">
          {conversions.map((c) => (
            <li key={String(c.id)}>
              {String(c.from_unit_id).slice(0, 8)} → {String(c.to_unit_id).slice(0, 8)} × {String(c.factor)}
              {c.product_id ? ` (product ${String(c.product_id).slice(0, 8)})` : " (org)"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
