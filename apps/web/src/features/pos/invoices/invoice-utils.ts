import type { InvoiceView } from "@electronic-erp/contracts";

export type InvoiceWorkspaceMode =
  | "invoices"
  | "receipts"
  | "tax"
  | "quotations"
  | "orders"
  | "credit-notes"
  | "debit-notes"
  | "reprint"
  | "digital";

export const INVOICE_META: Record<
  Exclude<InvoiceWorkspaceMode, "digital">,
  { title: string; description: string }
> = {
  invoices: {
    title: "Invoices",
    description: "Search posted sales invoices with line detail and actions.",
  },
  receipts: {
    title: "POS receipts",
    description: "Thermal-style receipts for posted sales — open a sale and reprint.",
  },
  tax: {
    title: "Tax invoices",
    description: "Tax documents issued for sales and compliance.",
  },
  quotations: {
    title: "Quotations",
    description: "Quotations created through after-sales — convert to orders when accepted.",
  },
  orders: {
    title: "Sales orders",
    description: "Open sales orders awaiting fulfilment or invoicing.",
  },
  "credit-notes": {
    title: "Credit notes",
    description: "Tax credit notes recorded against returns or adjustments.",
  },
  "debit-notes": {
    title: "Debit notes",
    description: "Tax debit notes for additional charges or corrections.",
  },
  reprint: {
    title: "Reprint",
    description: "Find a posted sale and reprint its invoice or receipt.",
  },
};

export function printInvoiceReceipt(invoice: InvoiceView, kind: "invoice" | "receipt" = "receipt") {
  const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
  if (!w) return false;
  const lines = (invoice.items ?? [])
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:right">${i.qty}</td><td style="text-align:right">${Number(i.total).toFixed(2)}</td></tr>`,
    )
    .join("");
  const heading = kind === "receipt" ? "POS Receipt" : "Tax Invoice";
  w.document.write(`<!doctype html><html><head><title>${invoice.invoiceNumber ?? heading}</title>
    <style>body{font-family:ui-monospace,monospace;font-size:12px;padding:16px} table{width:100%;border-collapse:collapse} td{padding:2px 0}</style>
    </head><body>
    <h2>${heading}</h2>
    <p>${invoice.invoiceNumber ?? ""}</p>
    <p>${invoice.customerName ?? "Walk-in"} · ${invoice.dateTime ? new Date(invoice.dateTime).toLocaleString() : ""}</p>
    <table>${lines}</table>
    <p><strong>Total ${Number(invoice.sale?.grandTotal ?? 0).toFixed(2)}</strong></p>
    <script>window.print()</script>
    </body></html>`);
  w.document.close();
  return true;
}

export function docField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v != null && v !== "") return String(v);
  }
  return "—";
}

export function docAmount(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (v != null && v !== "") return Number(v);
  }
  return 0;
}

export function filterTaxDocuments(
  items: Array<Record<string, unknown>>,
  type: "tax_invoice" | "credit_note" | "debit_note",
) {
  return items.filter((row) => {
    const t = String(row.document_type ?? row.documentType ?? "").toLowerCase();
    return t === type;
  });
}
