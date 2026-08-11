import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { enterpriseApi } from "./enterprise-api";

export function TaxPage() {
  const toast = useToast();
  const [ntn, setNtn] = useState("");
  const [strn, setStrn] = useState("");
  const [legalName, setLegalName] = useState("");
  const [rates, setRates] = useState<Array<Record<string, unknown>>>([]);
  const [code, setCode] = useState("GST18");
  const [name, setName] = useState("Sales tax 18%");
  const [ratePercent, setRatePercent] = useState("18");
  const [pricingMode, setPricingMode] = useState("exclusive");
  const [report, setReport] = useState<unknown>(null);
  const [taxableAmount, setTaxableAmount] = useState("1000");
  const [rateId, setRateId] = useState("");

  async function reload() {
    const [p, r] = await Promise.all([
      enterpriseApi.getTaxProfile(),
      enterpriseApi.listTaxRates(),
    ]);
    setNtn(String(p.item.ntn ?? ""));
    setStrn(String(p.item.strn ?? ""));
    setLegalName(String(p.item.legal_name ?? ""));
    setRates(r.items);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Pakistan Tax (architecture-ready)</h1>
      <p className="text-sm opacity-70">
        NTN, STRN, sales tax rates, tax invoices, reports, exemptions, inclusive/exclusive pricing.
        Live FBR integration is <strong>not</strong> claimed in this build — profile flag stays off.
      </p>

      <Card title="Tax profile">
        <div className="grid gap-2 md:grid-cols-3">
          <Input label="NTN" value={ntn} onChange={(e) => setNtn(e.target.value)} />
          <Input label="STRN" value={strn} onChange={(e) => setStrn(e.target.value)} />
          <Input
            label="Legal name"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
        </div>
        <Button
          className="mt-3"
          type="button"
          onClick={() =>
            void enterpriseApi
              .saveTaxProfile({ ntn, strn, legalName, fbrIntegrationEnabled: false })
              .then(() => toast.push({ title: "Tax profile saved (FBR not live)", tone: "success" }))
          }
        >
          Save profile
        </Button>
      </Card>

      <Card title="Tax rates">
        <div className="grid gap-2 md:grid-cols-4">
          <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Rate %"
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Pricing mode</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value)}
            >
              <option value="exclusive">tax-exclusive</option>
              <option value="inclusive">tax-inclusive</option>
            </select>
          </label>
        </div>
        <Button
          className="mt-2"
          type="button"
          onClick={() =>
            void enterpriseApi
              .createTaxRate({
                code,
                name,
                ratePercent: Number(ratePercent),
                pricingMode,
                isDefault: true,
              })
              .then(() => reload())
              .then(() => toast.push({ title: "Rate created", tone: "success" }))
          }
        >
          Add rate
        </Button>
        <ul className="mt-2 text-sm">
          {rates.map((r) => (
            <li key={String(r.id)}>
              <button type="button" className="underline" onClick={() => setRateId(String(r.id))}>
                {String(r.code)}
              </button>{" "}
              — {String(r.rate_percent)}% ({String(r.pricing_mode)})
              {r.is_exempt ? " · exempt" : ""}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Tax invoice / report">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            label="Taxable amount"
            value={taxableAmount}
            onChange={(e) => setTaxableAmount(e.target.value)}
          />
          <Input label="Tax rate id" value={rateId} onChange={(e) => setRateId(e.target.value)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void enterpriseApi
                .createTaxDocument({
                  documentType: "tax_invoice",
                  sourceType: "manual",
                  taxRateId: rateId || undefined,
                  taxableAmount: Number(taxableAmount),
                  taxAmount: 0,
                  grandTotal: Number(taxableAmount),
                  pricingMode,
                })
                .then(() => toast.push({ title: "Tax document created", tone: "success" }))
            }
          >
            Create tax invoice
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void enterpriseApi.taxReport().then(setReport)}
          >
            Tax report
          </Button>
        </div>
        <pre className="mt-3 max-h-64 overflow-auto text-xs">
          {report ? JSON.stringify(report, null, 2) : "Run tax report for local totals (not FBR)."}
        </pre>
      </Card>
    </div>
  );
}
