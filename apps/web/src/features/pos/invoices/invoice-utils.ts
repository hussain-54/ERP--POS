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
 * Format timestamp into consistent human-readable date & time.
 */
export function formatInvoiceDateTime(isoString?: string | null): { date: string; time: string; full: string } {
  if (!isoString) {
    const now = new Date();
    return {
      date: now.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      time: now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      full: now.toLocaleString(),
    };
  }
  const d = new Date(isoString);
  return {
    date: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    full: d.toLocaleString(),
  };
}

/**
 * Print 80mm Thermal Receipt or A4 Tax Invoice with dedicated print styling.
 */
export function printInvoiceReceipt(
  invoice: InvoiceView,
  kind: "receipt" | "thermal" | "a4" | "invoice" = "thermal",
  companyName = "Electronic & Electrical Store",
  isReprint = false
): boolean {
  const isA4 = kind === "a4" || kind === "invoice";
  const w = window.open(
    "",
    "_blank",
    isA4 ? "noopener,noreferrer,width=840,height=920" : "noopener,noreferrer,width=440,height=760"
  );
  if (!w) return false;

  const invNum = invoice.invoiceNumber ?? `INV-${Date.now()}`;
  const dt = formatInvoiceDateTime(invoice.dateTime ?? invoice.sale?.createdAt);
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const tax = Number(invoice.sale?.taxTotal ?? 0);
  const disc = Number(invoice.sale?.discountTotal ?? 0);
  const subtotal = Number(invoice.sale?.subtotal ?? (grand + disc - tax));
  const paid = Number(invoice.sale?.paidTotal ?? invoice.paidAmount ?? grand);
  const remaining = Number(invoice.sale?.remainingTotal ?? invoice.remainingAmount ?? Math.max(0, grand - paid));
  const change = Math.max(0, paid - grand);
  const customer = invoice.customerName ?? "Walk-in Customer";
  const customerPhone = invoice.customerMobile ?? "";
  const customerEmail = invoice.customerEmail ?? "";
  const branch = invoice.branchName ?? "Main Branch";
  const cashier = invoice.cashierName ?? "Counter Cashier";
  const terminal = invoice.terminalId ?? invoice.sale?.deviceId ?? "POS-01";
  const paymentMethod = invoice.payments?.length
    ? invoice.payments.map((p) => `${p.method}${p.reference ? ` (${p.reference})` : ""}`).join(", ")
    : "Cash";

  const rowsHtmlA4 = (invoice.items ?? [])
    .map((item, idx) => {
      const rate = Number(item.rate ?? 0);
      const listPrice = Number(item.listPrice ?? rate);
      const total = Number(item.total ?? (Number(item.qty) * rate));
      const itemDisc = Number(item.discount ?? 0);
      const itemTax = Number(item.tax ?? 0);
      const unitLabel = item.unit || "Pcs";
      const sku = item.sku ? `<div style="font-size: 11px; color: #64748b;">SKU: ${item.sku}</div>` : "";
      const original =
        listPrice > rate + 0.009
          ? `<div style="font-size: 11px; color: #94a3b8; text-decoration: line-through;">Rs. ${listPrice.toFixed(2)}</div>`
          : "";
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            <div style="font-weight: 700; color: #0f172a;">${idx + 1}. ${item.name}</div>
            ${sku}
            ${item.warrantyDays ? `<div style="font-size: 11px; color: #2563eb;">Warranty: ${item.warrantyDays} Days</div>` : ""}
          </td>
          <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            ${item.qty} ${unitLabel}
          </td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            ${original}
            <div>Rs. ${rate.toFixed(2)}</div>
          </td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #dc2626;">
            ${itemDisc > 0 ? `-Rs. ${itemDisc.toFixed(2)}` : "—"}
          </td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #475569;">
            ${itemTax > 0 ? `Rs. ${itemTax.toFixed(2)}` : "—"}
          </td>
          <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-weight: 700;">
            Rs. ${total.toFixed(2)}
          </td>
        </tr>
      `;
    })
    .join("");

  const rowsHtmlThermal = (invoice.items ?? [])
    .map((item, idx) => {
      const rate = Number(item.rate ?? 0);
      const listPrice = Number(item.listPrice ?? rate);
      const total = Number(item.total ?? (Number(item.qty) * rate));
      const itemDisc = Number(item.discount ?? 0);
      const unitLabel = item.unit || "Pcs";
      const skuLine = item.sku ? `<div style="font-size: 10px; color: #444;">SKU: ${item.sku}</div>` : "";
      const priceLine =
        listPrice > rate + 0.009
          ? `${item.qty} ${unitLabel} @ Rs. ${rate.toFixed(2)} (was ${listPrice.toFixed(2)})`
          : `${item.qty} ${unitLabel} @ Rs. ${rate.toFixed(2)}`;
      return `
        <tr>
          <td style="padding: 3px 0; text-align: left; vertical-align: top;">
            <div style="font-weight: 700;">${idx + 1}. ${item.name}</div>
            ${skuLine}
            <div style="font-size: 10px; color: #444;">${priceLine}${itemDisc > 0 ? ` (Disc: -${itemDisc.toFixed(2)})` : ""}</div>
          </td>
          <td style="padding: 3px 0; text-align: right; vertical-align: top; font-weight: 700; white-space: nowrap;">
            Rs. ${total.toFixed(2)}
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
        <meta charset="utf-8" />
        <title>${invNum} — Tax Invoice</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; margin: 0; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
          .title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em; }
          .reprint-badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
          .meta-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; color: #475569; }
          .totals-table { margin-left: auto; width: 320px; border-collapse: collapse; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
          .grand { font-size: 15px; font-weight: 900; border-top: 2px solid #0f172a; padding-top: 6px; margin-top: 4px; color: #0f172a; }
          .footer { margin-top: 36px; text-align: center; color: #64748b; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            ${isReprint ? `<div class="reprint-badge">★ DUPLICATE / REPRINT</div>` : ""}
            <div class="title">${companyName}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Retail POS & Distribution ERP · NTN: 8934211-7 · GST: 17-00-9821-001</div>
            <div style="color: #64748b; font-size: 11px;">Branch: <strong>${branch}</strong> | Terminal: <strong>${terminal}</strong> | Cashier: <strong>${cashier}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 900; color: #2563eb;">TAX INVOICE</div>
            <div style="font-weight: 800; font-size: 13px;"># ${invNum}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Date: ${dt.date}</div>
            <div style="font-size: 11px; color: #64748b;">Time: ${dt.time}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Customer / Billed To:</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${customer}</div>
            ${customerPhone ? `<div style="font-size: 11px; color: #475569;">Phone: ${customerPhone}</div>` : ""}
            ${customerEmail ? `<div style="font-size: 11px; color: #475569;">Email: ${customerEmail}</div>` : ""}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Payment Details:</div>
            <div style="font-size: 12px; font-weight: 800; color: #059669; margin-top: 2px;">Method: ${paymentMethod}</div>
            <div style="font-size: 11px; color: #475569;">Paid: Rs. ${paid.toFixed(2)} | Balance: Rs. ${remaining.toFixed(2)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 42%;">Item Description</th>
              <th style="text-align: center; width: 14%;">Qty / Unit</th>
              <th style="text-align: right; width: 14%;">Unit Price</th>
              <th style="text-align: right; width: 10%;">Discount</th>
              <th style="text-align: right; width: 10%;">Tax</th>
              <th style="text-align: right; width: 10%;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtmlA4}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="font-size: 11px; color: #475569; max-width: 320px;">
            <p style="font-weight: 700; margin: 0 0 4px 0; color: #0f172a;">Terms & Warranty:</p>
            <p style="margin: 0 0 2px 0;">• Warranty claims valid with original invoice copy within specified days.</p>
            <p style="margin: 0 0 2px 0;">• Electrical items subject to company warranty terms.</p>
          </div>

          <div class="totals-table">
            <div class="total-row"><span>Subtotal:</span><span>Rs. ${subtotal.toFixed(2)}</span></div>
            ${disc > 0 ? `<div class="total-row" style="color: #dc2626;"><span>Total Discounts:</span><span>-Rs. ${disc.toFixed(2)}</span></div>` : ""}
            ${tax > 0 ? `<div class="total-row"><span>GST / Tax:</span><span>Rs. ${tax.toFixed(2)}</span></div>` : ""}
            <div class="total-row grand"><span>Grand Total:</span><span>Rs. ${grand.toFixed(2)}</span></div>
            <div class="total-row" style="margin-top: 4px; font-weight: 700;"><span>Amount Paid:</span><span>Rs. ${paid.toFixed(2)}</span></div>
            ${change > 0 ? `<div class="total-row" style="color: #059669; font-weight: 700;"><span>Change Returned:</span><span>Rs. ${change.toFixed(2)}</span></div>` : ""}
            ${remaining > 0 ? `<div class="total-row" style="color: #d97706; font-weight: 700;"><span>Balance Due:</span><span>Rs. ${remaining.toFixed(2)}</span></div>` : ""}
          </div>
        </div>

        <div class="footer">
          Thank you for choosing ${companyName}! Software powered by Electronic ERP.
        </div>
        <script>
          window.addEventListener("load", () => { window.print(); });
        </script>
      </body>
      </html>
    `
    : `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${invNum} — POS Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: ui-monospace, "SF Mono", "Courier New", monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            width: 76mm;
            margin: 0 auto;
            padding: 4mm 2mm;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .store-name { font-size: 14px; font-weight: 900; letter-spacing: 0.05em; }
          .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-bottom: 2px double #000; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; }
          .flex-between { display: flex; justify-content: space-between; }
          .grand { font-size: 13px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="center">
          ${isReprint ? `<div style="font-weight: 900; border: 1px solid #000; padding: 1px; margin-bottom: 3px;">*** DUPLICATE REPRINT ***</div>` : ""}
          <div class="store-name">${companyName.toUpperCase()}</div>
          <div style="font-size: 10px;">${branch} · POS-${terminal}</div>
          <div style="font-size: 9px; color: #333;">NTN: 8934211-7 · Sales Tax Registered</div>
        </div>
        <div class="divider"></div>
        <div class="flex-between"><span>Inv: <strong>${invNum}</strong></span><span>${dt.date}</span></div>
        <div class="flex-between"><span>Time: ${dt.time}</span><span>Cashier: ${cashier}</span></div>
        <div class="flex-between"><span>Cust: ${customer}</span><span>${customerPhone}</span></div>
        <div class="double-divider"></div>
        <table>
          <tbody>
            ${rowsHtmlThermal}
          </tbody>
        </table>
        <div class="double-divider"></div>
        <div class="flex-between"><span>Subtotal:</span><span>Rs. ${subtotal.toFixed(2)}</span></div>
        ${disc > 0 ? `<div class="flex-between"><span>Discount:</span><span>-Rs. ${disc.toFixed(2)}</span></div>` : ""}
        ${tax > 0 ? `<div class="flex-between"><span>GST / Tax:</span><span>Rs. ${tax.toFixed(2)}</span></div>` : ""}
        <div class="divider"></div>
        <div class="flex-between grand"><span>TOTAL PAYABLE:</span><span>Rs. ${grand.toFixed(2)}</span></div>
        <div class="divider"></div>
        <div class="flex-between"><span>Method:</span><span>${paymentMethod}</span></div>
        <div class="flex-between"><span>Paid:</span><span>Rs. ${paid.toFixed(2)}</span></div>
        ${change > 0 ? `<div class="flex-between bold"><span>Change Returned:</span><span>Rs. ${change.toFixed(2)}</span></div>` : ""}
        ${remaining > 0 ? `<div class="flex-between bold"><span>Balance / Udhaar:</span><span>Rs. ${remaining.toFixed(2)}</span></div>` : ""}
        <div class="divider"></div>
        <div class="center" style="font-size: 10px; margin-top: 6px;">
          *** THANK YOU FOR VISITING ***<br/>
          Exchange within 3 days with original receipt.<br/>
          Electrical items subject to warranty terms.
        </div>
        <script>
          window.addEventListener("load", () => { window.print(); });
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
export function buildWhatsAppReceiptText(invoice: InvoiceView, companyName = "Electronic & Electrical Store"): string {
  const invNum = invoice.invoiceNumber ?? `INV-${Date.now()}`;
  const dt = formatInvoiceDateTime(invoice.dateTime ?? invoice.sale?.createdAt);
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const subtotal = Number(invoice.sale?.subtotal ?? grand);
  const disc = Number(invoice.sale?.discountTotal ?? 0);
  const tax = Number(invoice.sale?.taxTotal ?? 0);
  const paid = Number(invoice.sale?.paidTotal ?? invoice.paidAmount ?? grand);
  const remaining = Number(invoice.sale?.remainingTotal ?? invoice.remainingAmount ?? 0);
  const change = Math.max(0, paid - grand);
  const customer = invoice.customerName ?? "Walk-in Customer";
  const customerPhone = invoice.customerMobile ?? "";
  const paymentMethod = invoice.payments?.length
    ? invoice.payments.map((p) => p.method).join(", ")
    : "Cash";

  const itemsList = (invoice.items ?? [])
    .map(
      (i, idx) =>
        `${idx + 1}. *${i.name}*\n   Qty: ${i.qty} ${i.unit || "Pcs"} @ Rs. ${Number(i.rate).toFixed(2)}${
          Number(i.discount) > 0 ? ` (Disc: -Rs. ${Number(i.discount).toFixed(2)})` : ""
        } ➔ *Rs. ${Number(i.total).toFixed(2)}*`
    )
    .join("\n");

  return (
    `🧾 *${companyName.toUpperCase()}*\n` +
    `📍 Retail POS & Distribution ERP\n` +
    `════════════════════════════\n` +
    `📄 *Invoice #:* ${invNum}\n` +
    `📅 *Date:* ${dt.date} at ${dt.time}\n` +
    `👤 *Customer:* ${customer}${customerPhone ? ` (${customerPhone})` : ""}\n` +
    `🏪 *Branch:* ${invoice.branchName ?? "Main Branch"} | *Cashier:* ${invoice.cashierName ?? "Counter"}\n` +
    `════════════════════════════\n` +
    `*BILLED ITEMS:*\n${itemsList}\n` +
    `────────────────────────────\n` +
    `💰 *Subtotal:* Rs. ${subtotal.toFixed(2)}\n` +
    (disc > 0 ? `🎁 *Discount:* -Rs. ${disc.toFixed(2)}\n` : "") +
    (tax > 0 ? `🏛️ *Sales Tax (GST):* Rs. ${tax.toFixed(2)}\n` : "") +
    `⭐ *TOTAL PAYABLE: Rs. ${grand.toFixed(2)}*\n` +
    `────────────────────────────\n` +
    `💳 *Payment Method:* ${paymentMethod}\n` +
    `💵 *Amount Paid:* Rs. ${paid.toFixed(2)}\n` +
    (change > 0 ? `🪙 *Change Returned:* Rs. ${change.toFixed(2)}\n` : "") +
    (remaining > 0 ? `⚠️ *Outstanding Balance (Udhaar):* Rs. ${remaining.toFixed(2)}\n` : "") +
    `════════════════════════════\n` +
    `Thank you for your business! 🙏\n` +
    `• Exchange within 3 days with original invoice.\n` +
    `• Electrical warranty covered under company terms.`
  );
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

/**
 * Format email subject line.
 */
export function buildEmailReceiptSubject(invoice: InvoiceView, companyName = "Electronic Store"): string {
  const invNum = invoice.invoiceNumber ?? `INV-${Date.now()}`;
  return `Invoice #${invNum} — ${companyName}`;
}

/**
 * Open default email client with formatted invoice text.
 */
export function openEmailReceipt(invoice: InvoiceView, email?: string | null, companyName = "Electronic Store"): boolean {
  const subject = buildEmailReceiptSubject(invoice, companyName);
  const rawBody = buildWhatsAppReceiptText(invoice, companyName);
  const mailtoUrl = email
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(rawBody)}`
    : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(rawBody)}`;
  window.open(mailtoUrl, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Trigger PDF invoice download/print dialog.
 */
export function downloadPdfInvoice(invoice: InvoiceView, companyName = "Electronic & Electrical Store"): boolean {
  return printInvoiceReceipt(invoice, "a4", companyName);
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
