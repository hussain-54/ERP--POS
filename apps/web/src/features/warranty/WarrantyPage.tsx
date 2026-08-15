import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { afterSalesApi } from "@/features/quotations/after-sales-api";

export function WarrantyPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [lookup, setLookup] = useState({ serialCode: "", invoiceNumber: "" });
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [claims, setClaims] = useState<Array<Record<string, unknown>>>([]);
  const [claimForm, setClaimForm] = useState({
    saleWarrantyId: "",
    claimType: "repair",
    description: "",
  });
  const [replaceForm, setReplaceForm] = useState({
    warrantyClaimId: "",
    warehouseId: "",
    newProductId: "",
    unitId: "",
    qty: "1",
  });

  async function loadClaims() {
    const res = await afterSalesApi.listWarrantyClaims(branchId ?? undefined);
    setClaims(res.items);
  }

  useEffect(() => {
    void loadClaims().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    try {
      const params: Record<string, string> = {};
      if (lookup.serialCode) params.serialCode = lookup.serialCode;
      if (lookup.invoiceNumber) params.invoiceNumber = lookup.invoiceNumber;
      const res = await afterSalesApi.lookupWarranty(params);
      setResults(res.items);
      if (res.items[0]) {
        setClaimForm((p) => ({ ...p, saleWarrantyId: String(res.items[0]!.id) }));
      }
    } catch (err) {
      toast.push({
        title: "Lookup failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onClaim(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    try {
      await afterSalesApi.createWarrantyClaim({
        branchId,
        saleWarrantyId: claimForm.saleWarrantyId,
        claimType: claimForm.claimType,
        description: claimForm.description,
      });
      toast.push({ title: "Warranty claim opened", tone: "success" });
      await loadClaims();
    } catch (err) {
      toast.push({
        title: "Claim failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onReplace(e: FormEvent) {
    e.preventDefault();
    try {
      await afterSalesApi.postReplacement({
        warrantyClaimId: replaceForm.warrantyClaimId,
        warehouseId: replaceForm.warehouseId,
        newProductId: replaceForm.newProductId,
        unitId: replaceForm.unitId,
        qty: replaceForm.qty,
      });
      toast.push({ title: "Replacement posted + stock issued", tone: "success" });
      await loadClaims();
    } catch (err) {
      toast.push({
        title: "Replacement failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Warranty</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Linked to original sale warranties · claim · repair / replacement history
      </p>

      <Card title="Warranty lookup">
        <Form onSubmit={onLookup}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Serial"
              value={lookup.serialCode}
              onChange={(e) => setLookup((p) => ({ ...p, serialCode: e.target.value }))}
            />
            <Input
              label="Invoice number"
              value={lookup.invoiceNumber}
              onChange={(e) => setLookup((p) => ({ ...p, invoiceNumber: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit">Lookup</Button>
          </FormActions>
        </Form>
        <ul className="mt-3 space-y-2 text-sm">
          {results.map((w) => (
            <li key={String(w.id)} className="border-b py-2">
              Warranty {String(w.id).slice(0, 8)}… · sale {String(w.sale_id).slice(0, 8)}… ·{" "}
              {String(w.warranty_start)} → {String(w.warranty_end)}
            </li>
          ))}
          {!results.length ? <li className="text-[var(--erp-muted)]">No results</li> : null}
        </ul>
      </Card>

      <Card title="Open claim">
        <Form onSubmit={onClaim}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Sale warranty ID"
              required
              value={claimForm.saleWarrantyId}
              onChange={(e) => setClaimForm((p) => ({ ...p, saleWarrantyId: e.target.value }))}
            />
            <Select
              label="Type"
              options={[
                { value: "repair", label: "Repair" },
                { value: "replacement", label: "Replacement" },
              ]}
              value={claimForm.claimType}
              onChange={(e) => setClaimForm((p) => ({ ...p, claimType: e.target.value }))}
            />
            <Input
              label="Description"
              required
              value={claimForm.description}
              onChange={(e) => setClaimForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit">Create claim</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Post replacement">
        <Form onSubmit={onReplace}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Claim ID"
              required
              value={replaceForm.warrantyClaimId}
              onChange={(e) => setReplaceForm((p) => ({ ...p, warrantyClaimId: e.target.value }))}
            />
            <Input
              label="Warehouse ID"
              required
              value={replaceForm.warehouseId}
              onChange={(e) => setReplaceForm((p) => ({ ...p, warehouseId: e.target.value }))}
            />
            <Input
              label="New product ID"
              required
              value={replaceForm.newProductId}
              onChange={(e) => setReplaceForm((p) => ({ ...p, newProductId: e.target.value }))}
            />
            <Input
              label="Unit ID"
              required
              value={replaceForm.unitId}
              onChange={(e) => setReplaceForm((p) => ({ ...p, unitId: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit">Issue replacement</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Claims">
        <ul className="space-y-2 text-sm">
          {claims.map((c) => (
            <li key={String(c.id)} className="flex justify-between border-b py-2">
              <span>
                {String(c.claim_number)} · {String(c.claim_type)} · sale {String(c.sale_id).slice(0, 8)}…
              </span>
              <Badge>{String(c.status)}</Badge>
            </li>
          ))}
          {!claims.length ? <li className="text-[var(--erp-muted)]">No claims</li> : null}
        </ul>
      </Card>
    </div>
  );
}
