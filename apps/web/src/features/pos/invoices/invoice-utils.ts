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

/**
 * Print 80mm Thermal Receipt or A4 Tax Invoice with dedicated print styling.
 */
export function printInvoiceReceipt(
  invoice: InvoiceView,
  kind: "receipt" | "thermal" | "a4" | "invoice" = "thermal",
  companyName = "Electronic & Electrical Store"
) {
  const isA4 = kind === "a4" || kind === "invoice";
  const w = window.open(
    "",
    "_blank",
    isA4 ? "noopener,noreferrer,width=800,height=900" : "noopener,noreferrer,width=420,height=750"
  );
  if (!w) return false;

  const invNum = invoice.invoiceNumber ?? `INV-${Date.now()}`;
  const dt = invoice.dateTime ? new Date(invoice.dateTime).toLocaleString() : new Date().toLocaleString();
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const tax = Number(invoice.sale?.taxTotal ?? 0);
  const disc = Number(invoice.sale?.discountTotal ?? 0);
  const subtotal = Number(invoice.sale?.subtotal ?? (grand + disc - tax));
  const customer = invoice.customerName ?? "Walk-in Customer";

  const rowsHtml = (invoice.items ?? [])
    .map((item, idx) => {
      const rate = Number(item.rate ?? 0);
      const total = Number(item.total ?? (Number(item.qty) * rate));
      const itemDisc = Number(item.discount ?? 0);
      const unitLabel = item.unit || "Pcs";
      return `
        <tr>
          <td style="padding: 3px 0; text-align: left; vertical-align: top;">
            <div style="font-weight: 700;">${idx + 1}. ${item.name}</div>
            <div style="font-size: 10px; color: #555;">${item.qty} ${unitLabel} @ ${rate.toFixed(2)}${itemDisc > 0 ? ` (Disc: -${itemDisc.toFixed(2)})` : ""}</div>
          </td>
          <td style="padding: 3px 0; text-align: right; vertical-align: top; font-weight: 700; white-space: nowrap;">
            ${total.toFixed(2)}
          </td>
        </tr>
      `;
    })
    .join("");

  const content = isA4
    ? `
      <!doctype html>
      <html>
      <head>
        <title>${invNum} — Tax Invoice</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 32px; margin: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: 900; color: #0f172a; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .totals { margin-left: auto; width: 280px; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
          .grand { font-size: 16px; font-weight: 900; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 4px; color: #0f172a; }
          @media print { @page { size: A4; margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${companyName}</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Retail Point of Sale & Distribution</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 800; color: #1877f2;">TAX INVOICE</div>
            <div style="font-weight: 700;"># ${invNum}</div>
            <div style="font-size: 11px; color: #64748b;">${dt}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Billed To:</div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${customer}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Payment Status:</div>
            <div style="font-size: 13px; font-weight: 800; color: #059669; margin-top: 2px;">COMPLETED / PAID</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: right;">Total (PKR)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row"><span>Subtotal:</span><span>Rs. ${subtotal.toFixed(2)}</span></div>
          ${disc > 0 ? `<div class="total-row" style="color: #dc2626;"><span>Discount:</span><span>-Rs. ${disc.toFixed(2)}</span></div>` : ""}
          ${tax > 0 ? `<div class="total-row"><span>Tax / GST (17%):</span><span>Rs. ${tax.toFixed(2)}</span></div>` : ""}
          <div class="total-row grand"><span>Grand Total:</span><span>Rs. ${grand.toFixed(2)}</span></div>
        </div>

        <div style="margin-top: 48px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Thank you for your business! System generated electronic invoice.
        </div>
        <script>
          window.addEventListener("load", () => {
            window.print();
          });
        </script>
      </body>
      </html>
    `
    : `
      <!doctype html>
      <html>
      <head>
        <title>${invNum} — POS Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: ui-monospace, "SF Mono", "Courier New", monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000000;
            background: #ffffff;
            width: 76mm;
            margin: 0 auto;
            padding: 3mm 2mm;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .store-name { font-size: 14px; font-weight: 900; letter-spacing: 0.05em; }
          .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-bottom: 2px double #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          .flex-between { display: flex; justify-content: space-between; }
          .grand { font-size: 13px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="store-name">${companyName.toUpperCase()}</div>
          <div style="font-size: 10px;">RETAIL POS TERMINAL</div>
        </div>
        <div class="divider"></div>
        <div class="flex-between"><span>Inv: ${invNum}</span><span>${dt}</span></div>
        <div class="flex-between"><span>Cust: ${customer}</span><span>Status: PAID</span></div>
        <div class="double-divider"></div>
        <table>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="double-divider"></div>
        <div class="flex-between"><span>Subtotal:</span><span>Rs. ${subtotal.toFixed(2)}</span></div>
        ${disc > 0 ? `<div class="flex-between"><span>Discount:</span><span>-Rs. ${disc.toFixed(2)}</span></div>` : ""}
        ${tax > 0 ? `<div class="flex-between"><span>GST / Tax:</span><span>Rs. ${tax.toFixed(2)}</span></div>` : ""}
        <div class="divider"></div>
        <div class="flex-between grand"><span>TOTAL:</span><span>Rs. ${grand.toFixed(2)}</span></div>
        <div class="divider"></div>
        <div class="center" style="font-size: 10px; margin-top: 8px;">
          *** THANK YOU FOR VISITING ***<br/>
          Goods once sold can be exchanged within 3 days with receipt.
        </div>
        <script>
          window.addEventListener("load", () => {
            window.print();
          });
        </script>
      </body>
      </html>
    `;

  w.document.open();
  w.document.write(content);
  w.document.close();
  return true;
}

/**
 * Format receipt into plain text for WhatsApp sharing or SMS.
 */
export function buildWhatsAppReceiptText(invoice: InvoiceView, companyName = "Electronic Store"): string {
  const invNum = invoice.invoiceNumber ?? `INV-${Date.now()}`;
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const itemsList = (invoice.items ?? [])
    .map((i) => `• ${i.name} (x${i.qty}) — Rs. ${Number(i.total).toFixed(2)}`)
    .join("\n");

  return `*${companyName}* — POS Receipt\n\n` +
    `Invoice: *${invNum}*\n` +
    `Customer: ${invoice.customerName ?? "Walk-in"}\n` +
    `Date: ${new Date().toLocaleDateString()}\n\n` +
    `*Items:*\n${itemsList}\n\n` +
    `*Total Paid: Rs. ${grand.toFixed(2)}*\n\n` +
    `Thank you for shopping with us!`;
}

/**
 * Open WhatsApp Web/App with pre-formatted invoice text.
 */
export function openWhatsAppReceipt(invoice: InvoiceView, phone?: string | null, companyName?: string): boolean {
  const rawText = buildWhatsAppReceiptText(invoice, companyName);
  const cleanPhone = (phone ?? "").replace(/\D/g, "");
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rawText)}`
    : `https://wa.me/?text=${encodeURIComponent(rawText)}`;
  window.open(url, "_blank", "noopener,noreferrer");
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
  type: "tax_invoice" | "credit_note" | "debit_note"
) {
  return items.filter((row) => {
    const t = String(row.document_type ?? row.documentType ?? "").toLowerCase();
    return t === type;
  });
}
