import { describe, expect, it } from "vitest";
import {
  assertInvoiceActionSupported,
  buildSaleFinalizationAuditRow,
  buildSaleInvoiceDocument,
  renderSaleInvoiceText,
} from "./sale-finalization.js";
import type { Sale } from "@electronic-erp/contracts";

const sale: Sale = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organizationId: "11111111-1111-4111-8111-111111111111",
  branchId: "22222222-2222-4222-8222-222222222222",
  warehouseId: "33333333-3333-4333-8333-333333333333",
  invoiceNumber: "INV-TEST-1",
  status: "posted",
  posMode: "advanced",
  localeMode: "en",
  customerId: "66666666-6666-4666-8666-666666666666",
  salesmanUserId: "99999999-9999-4999-8999-999999999999",
  referenceName: "Walk-in ref",
  subtotal: 100,
  discountTotal: 5,
  taxTotal: 10,
  grandTotal: 105,
  paidTotal: 80,
  remainingTotal: 25,
  paymentStatus: "partial",
  dueDate: "2026-09-01",
  notes: "Net 15",
  postedAt: "2026-08-12T10:00:00.000Z",
  idempotencyKey: "88888888-8888-4888-8888-888888888888",
  deviceId: "TERM-01",
  offlineTransactionId: null,
  syncState: "synced",
  createdAt: "2026-08-12T10:00:00.000Z",
  updatedAt: "2026-08-12T10:00:00.000Z",
  version: 1,
};

describe("sale finalization invoice document", () => {
  it("builds invoice with required commercial fields", () => {
    const doc = buildSaleInvoiceDocument({
      sale,
      branchName: "Main Branch",
      terminalId: "TERM-01",
      cashierName: "Ali",
      customerName: "Customer A",
      customerMobile: "03001234567",
      customerAddress: "Lahore",
      salesmanName: "Sara",
      commissionPercent: 2,
      commissionAmount: 2.1,
      terms: "Net 15",
      warrantyNotes: "1 year parts",
      items: [
        {
          name: "Widget",
          qty: 2,
          unit: "pcs",
          rate: 50,
          discount: 5,
          tax: 10,
          total: 105,
          warrantyDays: 365,
        },
      ],
      payments: [{ method: "Cash", amount: 80 }],
    });

    expect(doc.invoiceNumber).toBe("INV-TEST-1");
    expect(doc.branchName).toBe("Main Branch");
    expect(doc.terminalId).toBe("TERM-01");
    expect(doc.cashierName).toBe("Ali");
    expect(doc.customerName).toBe("Customer A");
    expect(doc.paidAmount).toBe(80);
    expect(doc.remainingAmount).toBe(25);
    expect(doc.dueDate).toBe("2026-09-01");
    expect(doc.reference).toBe("Walk-in ref");
    expect(doc.salesmanName).toBe("Sara");
    expect(doc.commissionAmount).toBe(2.1);
    expect(doc.warrantyNotes).toBe("1 year parts");
    expect(doc.terms).toBe("Net 15");
    expect(doc.items[0]?.unit).toBe("pcs");
  });

  it("renders text for thermal and A4 actions", () => {
    const doc = buildSaleInvoiceDocument({
      sale,
      branchName: "Main",
      cashierName: "Ali",
      customerName: "Customer A",
      items: [
        {
          name: "Widget",
          qty: 1,
          unit: "pcs",
          rate: 100,
          discount: 0,
          tax: 0,
          total: 100,
          warrantyDays: 0,
        },
      ],
      payments: [{ method: "JazzCash", amount: 80 }],
    });
    const text80 = renderSaleInvoiceText(doc, "80mm");
    expect(text80).toContain("INV-TEST-1");
    expect(text80).toContain("JazzCash");
    expect(text80).toContain("Customer A");
    expect(renderSaleInvoiceText(doc, "58mm")).toContain("TOTAL");
    expect(renderSaleInvoiceText(doc, "a4")).toContain("Branch: Main");
  });

  it("supports invoice action catalog", () => {
    for (const action of [
      "save",
      "print_a4",
      "print_80mm",
      "print_58mm",
      "download_pdf",
      "whatsapp",
      "email",
    ] as const) {
      expect(() => assertInvoiceActionSupported(action)).not.toThrow();
    }
  });

  it("builds audit row for successful finalize", () => {
    const row = buildSaleFinalizationAuditRow({
      organizationId: sale.organizationId,
      branchId: sale.branchId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      grandTotal: 105,
      paidTotal: 80,
      status: "posted",
    });
    expect(row.action).toBe("sale.finalize");
    expect(row.entity_type).toBe("sale");
    expect(row.entity_id).toBe(sale.id);
  });
});
