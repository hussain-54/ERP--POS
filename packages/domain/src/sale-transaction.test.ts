import { describe, expect, it, vi } from "vitest";
import { SaleTransactionService } from "./sale-transaction.js";
import { assertDiscountAllowed } from "./discount-policy.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";
const customer = "66666666-6666-4666-8666-666666666666";
const method = "77777777-7777-4777-8777-777777777777";
const key = "88888888-8888-4888-8888-888888888888";

describe("discount approval", () => {
  it("enforces cashier 5% and manager 15%", () => {
    expect(() => assertDiscountAllowed("cashier", 5)).not.toThrow();
    expect(() => assertDiscountAllowed("cashier", 6)).toThrow(/limit/i);
    expect(() => assertDiscountAllowed("manager", 15)).not.toThrow();
    expect(() => assertDiscountAllowed("manager", 16)).toThrow(/limit/i);
    expect(() => assertDiscountAllowed("owner", 90)).not.toThrow();
  });
});

describe("SaleTransactionService", () => {
  it("posts complete sale flow through ports (stock, ledger, payment, accounting)", async () => {
    const calls: string[] = [];
    const ports = {
      findSaleByIdempotency: vi.fn(async () => null),
      searchStockAvailable: vi.fn(async () => "100"),
      postSaleRecord: vi.fn(async () => {
        calls.push("sale");
        return { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", invoiceNumber: "INV-1" };
      }),
      postSaleItems: vi.fn(async () => {
        calls.push("items");
      }),
      postDiscountAudits: vi.fn(async () => {
        calls.push("discounts");
      }),
      postStockSale: vi.fn(async () => {
        calls.push("stock");
      }),
      postCustomerSaleLedger: vi.fn(async () => {
        calls.push("ledger");
      }),
      postSplitPayment: vi.fn(async () => {
        calls.push("payment");
      }),
      postJournal: vi.fn(async () => {
        calls.push("accounting");
      }),
      postCommission: vi.fn(async () => {
        calls.push("commission");
      }),
      postWarranties: vi.fn(async () => {
        calls.push("warranty");
      }),
      createInstallment: vi.fn(async () => {
        calls.push("installment");
      }),
      postAnalytics: vi.fn(async () => {
        calls.push("analytics");
      }),
    };

    const service = new SaleTransactionService(ports);
    const result = await service.postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      customerId: customer,
      salesmanUserId: "99999999-9999-4999-8999-999999999999",
      commissionPercent: 2,
      items: [
        {
          productId: product,
          unitId: unit,
          qty: 2.5,
          unitPrice: 100,
          discount: 0,
          tax: 0,
          warrantyDays: 30,
          costPrice: 60,
        },
      ],
      payments: [
        { paymentMethodId: method, amount: 150 },
        { paymentMethodId: method, amount: 100 },
      ],
      discountTotal: 0,
      discounts: [],
      idempotencyKey: key,
      createInstallment: {
        downPayment: "50",
        installmentCount: 2,
        startDate: "2026-01-01",
      },
    });

    expect(result.invoiceNumber).toBe("INV-1");
    expect(result.totals.grandTotal).toBe(250);
    expect(calls).toEqual([
      "sale",
      "items",
      "stock",
      "ledger",
      "payment",
      "accounting",
      "commission",
      "warranty",
      "installment",
      "analytics",
    ]);
    expect(ports.postStockSale).toHaveBeenCalledWith(
      expect.objectContaining({ qty: "2.5", productId: product }),
    );
  });

  it("prevents duplicate sync via idempotency", async () => {
    const ports = {
      findSaleByIdempotency: vi.fn(async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        invoice_number: "INV-DUP",
      })),
      searchStockAvailable: vi.fn(),
      postSaleRecord: vi.fn(),
      postSaleItems: vi.fn(),
      postDiscountAudits: vi.fn(),
      postStockSale: vi.fn(),
      postCustomerSaleLedger: vi.fn(),
      postSplitPayment: vi.fn(),
      postJournal: vi.fn(),
      postCommission: vi.fn(),
      postWarranties: vi.fn(),
      postAnalytics: vi.fn(),
    };
    const service = new SaleTransactionService(ports);
    const result = await service.postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 10, discount: 0, tax: 0 }],
      payments: [],
      discounts: [],
      idempotencyKey: key,
    });
    expect(result.invoiceNumber).toBe("INV-DUP");
    expect(ports.postSaleRecord).not.toHaveBeenCalled();
    expect(ports.postStockSale).not.toHaveBeenCalled();
  });

  it("posts credit sale with remaining balance and accounting", async () => {
    const ports = {
      findSaleByIdempotency: vi.fn(async () => null),
      searchStockAvailable: vi.fn(async () => "50"),
      postSaleRecord: vi.fn(async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        invoiceNumber: "INV-CREDIT",
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
    const service = new SaleTransactionService(ports);
    const result = await service.postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      customerId: customer,
      items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 200, discount: 0, tax: 0 }],
      payments: [{ paymentMethodId: method, amount: 50 }],
      discounts: [],
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      dueDate: "2026-09-01",
    });
    expect(result.paidTotal).toBe(50);
    expect(result.remainingTotal).toBe(150);
    expect(ports.postCustomerSaleLedger).toHaveBeenCalled();
    expect(ports.postJournal).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "sale" }),
    );
  });

  it("creates discount audit and blocks cashier over limit", async () => {
    const service = new SaleTransactionService({
      findSaleByIdempotency: async () => null,
      searchStockAvailable: async () => "10",
      postSaleRecord: async () => ({ id: "x", invoiceNumber: "y" }),
      postSaleItems: async () => undefined,
      postDiscountAudits: async () => undefined,
      postStockSale: async () => undefined,
      postCustomerSaleLedger: async () => undefined,
      postSplitPayment: async () => undefined,
      postJournal: async () => undefined,
      postCommission: async () => undefined,
      postWarranties: async () => undefined,
      postAnalytics: async () => undefined,
    });
    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
        payments: [],
        discountTotal: 10,
        discounts: [
          {
            scope: "invoice",
            kind: "special",
            amount: 10,
            percent: 10,
            approverRole: "cashier",
            reason: "too high for cashier",
          },
        ],
        idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
    ).rejects.toThrow(/limit/i);
  });

  it("validates stock reduction requirement", async () => {
    const service = new SaleTransactionService({
      findSaleByIdempotency: async () => null,
      searchStockAvailable: async () => "1",
      postSaleRecord: async () => ({ id: "x", invoiceNumber: "y" }),
      postSaleItems: async () => undefined,
      postDiscountAudits: async () => undefined,
      postStockSale: async () => undefined,
      postCustomerSaleLedger: async () => undefined,
      postSplitPayment: async () => undefined,
      postJournal: async () => undefined,
      postCommission: async () => undefined,
      postWarranties: async () => undefined,
      postAnalytics: async () => undefined,
    });
    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        items: [{ productId: product, unitId: unit, qty: 5, unitPrice: 10, discount: 0, tax: 0 }],
        payments: [],
        discounts: [],
        idempotencyKey: key,
      }),
    ).rejects.toThrow(/Insufficient stock/i);
  });
});
