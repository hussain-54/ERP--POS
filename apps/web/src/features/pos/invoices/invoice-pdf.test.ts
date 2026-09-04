import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@electronic-erp/contracts";
import { buildInvoicePdfBytes } from "./invoice-pdf";

const invoice: InvoiceView = {
  invoiceNumber: "INV-1001",
  customerName: "Walk-in Customer",
  customerMobile: "03001234567",
  customerEmail: "a@example.com",
  branchName: "Main Branch",
  cashierName: "Cashier 01",
  terminalId: "POS-01",
  dateTime: "2026-09-04T10:00:00.000Z",
  sale: {
    id: "sale-1",
    organizationId: "org-1",
    branchId: "branch-1",
    warehouseId: "wh-1",
    invoiceNumber: "INV-1001",
    subtotal: 1000,
    discountTotal: 50,
    taxTotal: 161.5,
    grandTotal: 1111.5,
    paidTotal: 1200,
    remainingTotal: 0,
    posMode: "easy",
    localeMode: "en",
    status: "posted",
    paymentStatus: "paid",
    idempotencyKey: "idem-1",
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-04T10:00:00.000Z",
    version: 1,
  },
  items: [
    {
      name: "LED Bulb 12W",
      sku: "LED-12",
      unit: "Pcs",
      qty: 2,
      listPrice: 550,
      rate: 500,
      discount: 50,
      tax: 161.5,
      total: 950,
    },
  ],
  payments: [{ method: "Cash", amount: 1200, reference: "CASH-1" }],
};

describe("buildInvoicePdfBytes", () => {
  it("creates a PDF-1.4 file containing invoice fields", () => {
    const bytes = buildInvoicePdfBytes(invoice);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("%%EOF");
    expect(text).toContain("INV-1001");
    expect(text).toContain("LED Bulb 12W");
    expect(text).toContain("LED-12");
    expect(text).toContain("Cash");
  });
});
