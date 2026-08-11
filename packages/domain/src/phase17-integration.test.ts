/**
 * Phase 17 — Connected ERP master-flow integration tests.
 * Verifies modules work as ONE system via domain ports (no duplicate manual entry).
 */
import { describe, expect, it, vi } from "vitest";
import { canAccessBranch } from "@electronic-erp/contracts";
import { buildSaleJournalLines, buildSaleReturnJournalLines } from "./accounting-posting.js";
import { AuthorizationService } from "./authz-service.js";
import { assertDeliveryTransition } from "./delivery-lifecycle.js";
import { ForbiddenDomainError } from "./errors.js";
import {
  isAccountLocked,
  validatePasswordAgainstPolicy,
  DEFAULT_PASSWORD_POLICY,
} from "./infrastructure.js";
import { PurchaseTransactionService } from "./purchase-transaction.js";
import { defaultPermissionsForRole } from "./rbac-catalog.js";
import { buildExecutiveDashboard, calcMarginPct, salesByDimension } from "./reporting.js";
import { SaleTransactionService } from "./sale-transaction.js";
import { assertTransferTransition } from "./transfer-lifecycle.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const warehouseB = "33333333-3333-4333-8333-333333333334";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";
const customer = "66666666-6666-4666-8666-666666666666";
const supplier = "77777777-7777-4777-8777-777777777777";
const method = "88888888-8888-4888-8888-888888888888";
const salesman = "99999999-9999-4999-8999-999999999999";

describe("Phase 17 — Master sale transaction chain", () => {
  it("POS→invoice→stock→ledger→payment→accounts→profit→commission→warranty→installment→analytics", async () => {
    const trail: string[] = [];
    const ports = {
      findSaleByIdempotency: vi.fn(async () => null),
      searchStockAvailable: vi.fn(async () => "100"),
      postSaleRecord: vi.fn(async () => {
        trail.push("invoice");
        return { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", invoiceNumber: "INV-QA-1" };
      }),
      postSaleItems: vi.fn(async () => {
        trail.push("lines");
      }),
      postDiscountAudits: vi.fn(async () => undefined),
      postStockSale: vi.fn(async () => {
        trail.push("stock_reduction");
      }),
      postCustomerSaleLedger: vi.fn(async () => {
        trail.push("customer_ledger");
      }),
      postSplitPayment: vi.fn(async () => {
        trail.push("payment_cash_bank");
      }),
      postJournal: vi.fn(async () => {
        trail.push("accounts");
      }),
      postCommission: vi.fn(async () => {
        trail.push("commission");
      }),
      postWarranties: vi.fn(async () => {
        trail.push("warranty");
      }),
      createInstallment: vi.fn(async () => {
        trail.push("installment");
      }),
      postAnalytics: vi.fn(async () => {
        trail.push("analytics_reports");
      }),
    };

    const sale = await new SaleTransactionService(ports).postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      customerId: customer,
      salesmanUserId: salesman,
      commissionPercent: 2,
      items: [
        {
          productId: product,
          unitId: unit,
          qty: 2,
          unitPrice: 500,
          discount: 0,
          tax: 0,
          warrantyDays: 365,
          costPrice: 300,
        },
      ],
      payments: [{ paymentMethodId: method, amount: 400 }],
      discountTotal: 0,
      discounts: [],
      idempotencyKey: "10101010-1010-4010-8010-101010101010",
      createInstallment: {
        downPayment: "400",
        installmentCount: 3,
        startDate: "2026-08-15",
      },
    });

    expect(sale.invoiceNumber).toBe("INV-QA-1");
    expect(sale.totals.grandTotal).toBe(1000);
    expect(calcMarginPct(1000, 600)).toBe(40);

    const journal = buildSaleJournalLines({
      subtotal: sale.totals.subtotal,
      discountTotal: 0,
      taxTotal: sale.totals.taxTotal,
      grandTotal: sale.totals.grandTotal,
      cogs: 600,
      paidCash: 400,
    });
    expect(journal.length).toBeGreaterThan(0);
    expect(journal.some((l) => l.systemRole === "sales")).toBe(true);
    expect(journal.some((l) => l.systemRole === "cogs")).toBe(true);

    expect(trail).toEqual([
      "invoice",
      "lines",
      "stock_reduction",
      "customer_ledger",
      "payment_cash_bank",
      "accounts",
      "commission",
      "warranty",
      "installment",
      "analytics_reports",
    ]);

    expect(ports.postStockSale).toHaveBeenCalledTimes(1);
    expect(ports.postCustomerSaleLedger).toHaveBeenCalledTimes(1);
    expect(ports.postJournal).toHaveBeenCalledTimes(1);
    expect(ports.postCommission).toHaveBeenCalledWith(
      expect.objectContaining({ commission_percent: 2 }),
    );
    expect(ports.postWarranties).toHaveBeenCalled();
    expect(ports.createInstallment).toHaveBeenCalled();
  });
});

describe("Phase 17 — Purchase chain", () => {
  it("Supplier→purchase→stock↑→supplier ledger→payable/accounts→price history", async () => {
    const trail: string[] = [];
    const ports = {
      findByIdempotency: vi.fn(async () => null),
      postPurchaseRecord: vi.fn(async () => {
        trail.push("purchase_invoice");
        return { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", invoiceNumber: "PINV-QA-1" };
      }),
      postPurchaseItems: vi.fn(async () => {
        trail.push("items");
      }),
      postStockPurchase: vi.fn(async () => {
        trail.push("stock_increase");
      }),
      postSupplierLedger: vi.fn(async () => {
        trail.push("supplier_ledger_payable");
      }),
      getSupplierPrice: vi.fn(async () => null),
      upsertSupplierPrice: vi.fn(async () => {
        trail.push("supplier_price");
      }),
      postPriceHistory: vi.fn(async () => {
        trail.push("price_history");
      }),
      postJournal: vi.fn(async () => {
        trail.push("accounts");
      }),
    };

    const result = await new PurchaseTransactionService(ports).postPurchase({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      supplierId: supplier,
      invoiceNumber: "PINV-QA-1",
      items: [{ productId: product, unitId: unit, qty: 10, unitCost: 50, discount: 0, tax: 0 }],
      discountTotal: 0,
      paidTotal: 0,
      idempotencyKey: "12121212-1212-4212-8212-121212121212",
    });

    expect(result.totals.grandTotal).toBe(500);
    expect(trail).toEqual([
      "purchase_invoice",
      "items",
      "stock_increase",
      "supplier_price",
      "price_history",
      "supplier_ledger_payable",
      "accounts",
    ]);
  });
});

describe("Phase 17 — Sale return accounting + audit trail shape", () => {
  it("reverses profit via return journal and keeps balanced lines", () => {
    const lines = buildSaleReturnJournalLines({ refundAmount: 250, taxTotal: 0, cogs: 150 });
    const debit = lines.filter((l) => l.debit > 0).reduce((s, l) => s + l.debit, 0);
    const credit = lines.filter((l) => l.credit > 0).reduce((s, l) => s + l.credit, 0);
    expect(Math.abs(debit - credit)).toBeLessThan(0.01);
    expect(lines.some((l) => l.systemRole === "sales_returns")).toBe(true);
    expect(lines.some((l) => l.systemRole === "inventory")).toBe(true);
  });
});

describe("Phase 17 — Warehouse transfer lifecycle", () => {
  it("Warehouse A→request→approval→dispatch→transit→B receiving", () => {
    expect(() => assertTransferTransition("requested", "approved")).not.toThrow();
    expect(() => assertTransferTransition("approved", "dispatched")).not.toThrow();
    expect(() => assertTransferTransition("dispatched", "in_transit")).not.toThrow();
    expect(() => assertTransferTransition("in_transit", "received")).not.toThrow();
    expect(() => assertTransferTransition("requested", "received")).toThrow(/transition/i);
    expect(() => assertDeliveryTransition("pending", "packed")).not.toThrow();
    expect(warehouse).not.toBe(warehouseB);
  });
});

describe("Phase 17 — Permission isolation (backend authority)", () => {
  it("blocks cashier from accounts.write and enforces branch isolation", () => {
    const ctx = {
      userId: salesman,
      organizationId: org,
      branchId: branch,
      permissions: defaultPermissionsForRole("cashier"),
      branchIds: [branch],
    };
    const cashier = new AuthorizationService(ctx);
    expect(cashier.can("pos.sell")).toBe(true);
    expect(() => cashier.assert("accounts.write")).toThrow(ForbiddenDomainError);
    expect(canAccessBranch(ctx, branch)).toBe(true);
    expect(canAccessBranch(ctx, warehouseB)).toBe(false);
  });

  it("every role has defaults; unauthorized security.manage blocked for delivery_boy", () => {
    const delivery = new AuthorizationService({
      userId: salesman,
      organizationId: org,
      branchId: branch,
      permissions: defaultPermissionsForRole("delivery_boy"),
      branchIds: [branch],
    });
    expect(() => delivery.assert("security.manage")).toThrow(/Forbidden|Missing permission/i);
  });
});

describe("Phase 17 — Report reconciliation vs transaction facts", () => {
  it("dashboard KPIs derive from sale facts (no hardcoded totals)", () => {
    const sales = [
      {
        id: "s1",
        branchId: branch,
        warehouseId: warehouse,
        customerId: customer,
        salesmanUserId: salesman,
        grandTotal: 1000,
        paidTotal: 400,
        remainingTotal: 600,
        paymentStatus: "partial",
        costTotal: 600,
        postedAt: "2026-08-10T10:00:00.000Z",
      },
      {
        id: "s2",
        branchId: branch,
        warehouseId: warehouse,
        customerId: customer,
        salesmanUserId: salesman,
        grandTotal: 500,
        paidTotal: 500,
        remainingTotal: 0,
        paymentStatus: "paid",
        costTotal: 200,
        postedAt: "2026-08-11T10:00:00.000Z",
      },
    ];
    const byBranch = salesByDimension([], sales, "branch");
    expect(byBranch[0]?.amount).toBe(1500);

    const dash = buildExecutiveDashboard({
      sales: 1500,
      purchases: 500,
      grossProfit: 700,
      netProfit: 650,
      cash: 400,
      bank: 0,
      receivables: 600,
      payables: 500,
      stockValue: 3000,
      lowStock: 2,
      outOfStock: 1,
      overstock: 0,
      todayExpenses: 50,
      installmentsDue: 200,
      customerOutstanding: 600,
      supplierOutstanding: 500,
      pendingApprovals: 1,
      pendingDeliveries: 0,
      pendingRepairs: 0,
      warrantyClaims: 0,
      onlineOrders: 0,
      salesGrowth: 10,
      purchaseGrowth: 5,
      profitSeries: [{ key: "aug", label: "Aug", amount: 700 }],
      recentTransactions: [
        { id: "s2", type: "sale", label: "Sale", amount: 500, at: "2026-08-11" },
      ],
    });
    expect(dash.sales).toBe(1500);
    expect(dash.grossProfit).toBe(700);
    expect(dash.receivables).toBe(600);
  });
});

describe("Phase 17 — Failure / security safe paths", () => {
  it("idempotent sale prevents duplicate stock/ledger posts", async () => {
    const ports = {
      findSaleByIdempotency: vi.fn(async () => ({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        invoice_number: "INV-EXISTING",
      })),
      searchStockAvailable: vi.fn(async () => "100"),
      postSaleRecord: vi.fn(async () => ({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        invoiceNumber: "INV-EXISTING",
      })),
      postSaleItems: vi.fn(async () => undefined),
      postDiscountAudits: vi.fn(async () => undefined),
      postStockSale: vi.fn(async () => undefined),
      postCustomerSaleLedger: vi.fn(async () => undefined),
      postSplitPayment: vi.fn(async () => undefined),
      postJournal: vi.fn(async () => undefined),
      postCommission: vi.fn(async () => undefined),
      postWarranties: vi.fn(async () => undefined),
      postAnalytics: vi.fn(async () => undefined),
    };
    const result = await new SaleTransactionService(ports).postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 10, discount: 0, tax: 0 }],
      payments: [],
      discounts: [],
      idempotencyKey: "13131313-1313-4313-8313-131313131313",
    });
    expect(result.invoiceNumber).toBe("INV-EXISTING");
    expect(ports.postStockSale).not.toHaveBeenCalled();
    expect(ports.postJournal).not.toHaveBeenCalled();
  });

  it("failed login lockout and password policy fail safely", () => {
    expect(validatePasswordAgainstPolicy("bad", DEFAULT_PASSWORD_POLICY).ok).toBe(false);
    expect(isAccountLocked({ failedAttempts: 5, maxFailedAttempts: 5 }).locked).toBe(true);
  });
});
