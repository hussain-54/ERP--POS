import type { POSBadgeTone } from "./design-system";

export const REFERENCE_TABLE_COLUMNS = [
  "Reference #",
  "Type",
  "Customer",
  "Invoice",
  "Salesman",
  "Amount",
  "Date",
  "Status",
  "Action",
] as const;

export const REFERENCE_TYPES = [
  { value: "outside", label: "Outside" },
  { value: "dealer", label: "Dealer" },
  { value: "influencer", label: "Influencer" },
  { value: "employee", label: "Employee" },
  { value: "other", label: "Other" },
] as const;

export type ReferenceRegisterRow = {
  id: string;
  referenceId: string;
  referenceNumber: string;
  type: string;
  customer: string;
  invoice: string;
  saleId: string | null;
  salesman: string;
  amount: number | null;
  date: string | null;
  status: string;
  selectableOnSale: boolean;
};

export function referenceStatusTone(status: string): POSBadgeTone {
  if (status === "active" || status === "posted") return "success";
  if (status === "inactive") return "neutral";
  if (status === "void") return "danger";
  return "warning";
}

export function parseReferenceDirectory(items: Array<Record<string, unknown>>) {
  return items.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    code: String(row.reference_code ?? row.referenceCode ?? ""),
    type: String(row.reference_type ?? row.referenceType ?? "outside"),
    mobile: String(row.mobile ?? ""),
    active: row.is_active !== false,
  }));
}

export function buildReferenceRegister(
  directory: ReturnType<typeof parseReferenceDirectory>,
  sales: Array<Record<string, unknown>>,
): ReferenceRegisterRow[] {
  const byId = new Map(directory.map((item) => [item.id, item]));
  const used = new Set<string>();
  const rows: ReferenceRegisterRow[] = [];

  for (const sale of sales) {
    const referenceId = String(sale.referenceId ?? sale.reference_id ?? "");
    if (!referenceId) continue;
    used.add(referenceId);
    const dir = byId.get(referenceId);
    const invoice = String(sale.invoiceNumber ?? sale.invoice_number ?? "");
    rows.push({
      id: `${referenceId}:${String(sale.id ?? invoice)}`,
      referenceId,
      referenceNumber: dir?.code || String(sale.referenceName ?? sale.reference_name ?? ""),
      type: dir?.type ?? "outside",
      customer: String(sale.customerName ?? sale.customer_name ?? "") || "Walk-in",
      invoice: invoice || "—",
      saleId: sale.id != null ? String(sale.id) : null,
      salesman: String(sale.salesmanName ?? sale.salesman_name ?? "") || "—",
      amount: Number(sale.grandTotal ?? sale.grand_total ?? 0) || 0,
      date: String(sale.postedAt ?? sale.posted_at ?? sale.createdAt ?? sale.created_at ?? "") || null,
      status: String(sale.status ?? "posted"),
      selectableOnSale: dir?.active !== false,
    });
  }

  for (const dir of directory) {
    if (used.has(dir.id)) continue;
    rows.push({
      id: dir.id,
      referenceId: dir.id,
      referenceNumber: dir.code || dir.name,
      type: dir.type,
      customer: "—",
      invoice: "—",
      saleId: null,
      salesman: "—",
      amount: null,
      date: null,
      status: dir.active ? "active" : "inactive",
      selectableOnSale: dir.active,
    });
  }

  return rows;
}
