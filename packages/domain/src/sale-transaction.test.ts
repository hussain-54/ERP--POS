import { describe, expect, it, vi } from "vitest";
import { SaleTransactionService, type SaleTransactionPorts } from "./sale-transaction.js";
import { assertDiscountAllowed } from "./discount-policy.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";
const customer = "66666666-6666-4666-8666-666666666666";
const method = "77777777-7777-4777-8777-777777777777";
const key = "88888888-8888-4888-8888-888888888888";

function basePorts(overrides: Partial<SaleTransactionPorts> = {}): SaleTransactionPorts {
  return {
    findSaleByIdempotency: vi.fn(async () => null),
    searchStockAvailable: vi.fn(async () => "100"),
    postSaleRecord: vi.fn(async () => ({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      invoiceNumber: "INV-1",
    })),
    postSaleItems: vi.fn(async () => undefined),
    postDiscountAudits: vi.fn(async () => undefined),
    postStockSale: vi.fn(async () => undefined),
    reverseStockSale: vi.fn(async () => undefined),
    postCustomerSaleLedger: vi.fn(async () => undefined),
    postSplitPayment: vi.fn(async () => undefined),
    updateSalePaymentState: vi.fn(async () => undefined),
    finalizeSaleStatus: vi.fn(async () => undefined),
    voidIncompleteSale: vi.fn(async () => undefined),
    postJournal: vi.fn(async () => undefined),
    postCommission: vi.fn(async () => undefined),
    postWarranties: vi.fn(async () => undefined),
    createInstallment: vi.fn(async () => undefined),
    postAnalytics: vi.fn(async () => undefined),
    postAudit: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("discount approval", () => {
  it("enforces ladder: cashier 5%, supervisor 10%, manager 20%, owner 50%, special unlimited", () => {
    expect(() => assertDiscountAllowed("cashier", 5)).not.toThrow();
    expect(() => assertDiscountAllowed("cashier", 6)).toThrow(/limit/i);
    expect(() => assertDiscountAllowed("supervisor", 10)).not.toThrow();
    expect(() => assertDiscountAllowed("supervisor", 11)).toThrow(/limit/i);
    expect(() => assertDiscountAllowed("manager", 20)).not.toThrow();
    expect(() => assertDiscountAllowed("manager", 21)).toThrow(/limit/i);
    expect(() => assertDiscountAllowed("owner", 50)).not.toThrow();
    expect(() => assertDiscountAllowed("owner", 51)).toThrow(/limit/i);
    expect(() => assertDiscountAllowed("special", 90)).not.toThrow();
  });
});

describe("SaleTransactionService", () => {
  it("posts complete sale flow through ports (stock, ledger, payment, accounting)", async () => {
    const calls: string[] = [];
    const ports = basePorts({
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
      updateSalePaymentState: vi.fn(async () => {
        calls.push("payment_state");
      }),
      finalizeSaleStatus: vi.fn(async () => {
        calls.push("finalize");
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
      postAudit: vi.fn(async () => {
        calls.push("audit");
      }),
    });

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
      "payment_state",
      "finalize",
      "accounting",
      "commission",
      "warranty",
      "installment",
      "analytics",
      "audit",
    ]);
    expect(ports.postSaleRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft", posted_at: null }),
    );
    expect(ports.postStockSale).toHaveBeenCalledWith(
      expect.objectContaining({ qty: "2.5", productId: product }),
    );
  });

  it("prevents duplicate sync via idempotency for posted sales", async () => {
    const ports = basePorts({
      findSaleByIdempotency: vi.fn(async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        invoice_number: "INV-DUP",
        status: "posted",
        paid_total: 10,
        remaining_total: 0,
        grand_total: 10,
      })),
      postSaleRecord: vi.fn(),
      postStockSale: vi.fn(),
    });
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
    expect(result.paidTotal).toBe(10);
    expect(ports.postSaleRecord).not.toHaveBeenCalled();
    expect(ports.postStockSale).not.toHaveBeenCalled();
  });

  it("rejects duplicate submission while draft finalization is in progress", async () => {
    const ports = basePorts({
      findSaleByIdempotency: vi.fn(async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        invoice_number: "INV-DRAFT",
        status: "draft",
      })),
    });
    const service = new SaleTransactionService(ports);
    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 10, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: method, amount: 10 }],
        discounts: [],
        idempotencyKey: key,
      }),
    ).rejects.toThrow(/already in progress/i);
    expect(ports.postSaleRecord).not.toHaveBeenCalled();
  });

  it("does not mark sale posted when stock update fails — voids draft and reverses nothing applied", async () => {
    const ports = basePorts({
      postStockSale: vi.fn(async () => {
        throw new Error("stock write failed");
      }),
    });
    const service = new SaleTransactionService(ports);
    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        customerId: customer,
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: method, amount: 100 }],
        discounts: [],
        idempotencyKey: key,
      }),
    ).rejects.toThrow(/stock write failed/i);

    expect(ports.finalizeSaleStatus).not.toHaveBeenCalled();
    expect(ports.voidIncompleteSale).toHaveBeenCalledWith(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expect.stringMatching(/stock write failed/i),
    );
    expect(ports.postJournal).not.toHaveBeenCalled();
    expect(ports.postSplitPayment).not.toHaveBeenCalled();
  });

  it("reverses prior stock lines and voids when a later stock line fails", async () => {
    const productB = "44444444-4444-4444-8444-444444444445";
    let stockCalls = 0;
    const ports = basePorts({
      searchStockAvailable: vi.fn(async () => "10"),
      postStockSale: vi.fn(async () => {
        stockCalls += 1;
        if (stockCalls === 2) throw new Error("second stock fail");
      }),
    });
    const service = new SaleTransactionService(ports);
    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        items: [
          { productId: product, unitId: unit, qty: 1, unitPrice: 50, discount: 0, tax: 0 },
          { productId: productB, unitId: unit, qty: 1, unitPrice: 50, discount: 0, tax: 0 },
        ],
        payments: [{ paymentMethodId: method, amount: 100 }],
        discounts: [],
        idempotencyKey: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toThrow(/second stock fail/i);

    expect(ports.reverseStockSale).toHaveBeenCalledTimes(1);
    expect(ports.reverseStockSale).toHaveBeenCalledWith(
      expect.objectContaining({ productId: product, operationId: expect.stringContaining("reverse") }),
    );
    expect(ports.finalizeSaleStatus).not.toHaveBeenCalled();
    expect(ports.voidIncompleteSale).toHaveBeenCalled();
  });

  it("voids draft when payment recording fails after stock — never posted", async () => {
    const ports = basePorts({
      postSplitPayment: vi.fn(async () => {
        throw new Error("payment gateway timeout");
      }),
    });
    const service = new SaleTransactionService(ports);
    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        customerId: customer,
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: method, amount: 100 }],
        discounts: [],
        idempotencyKey: key,
      }),
    ).rejects.toThrow(/payment gateway timeout/i);

    expect(ports.postStockSale).toHaveBeenCalled();
    expect(ports.reverseStockSale).toHaveBeenCalled();
    expect(ports.finalizeSaleStatus).not.toHaveBeenCalled();
    expect(ports.voidIncompleteSale).toHaveBeenCalled();
  });

  it("posts credit sale with remaining balance and accounting", async () => {
    const ports = basePorts();
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
    expect(ports.finalizeSaleStatus).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ paidTotal: 50, remainingTotal: 150 }),
    );
    expect(ports.postJournal).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "sale" }),
    );
  });

  it("creates discount audit and blocks cashier over limit", async () => {
    const service = new SaleTransactionService(basePorts());
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
    const ports = basePorts({
      searchStockAvailable: async () => "1",
    });
    const service = new SaleTransactionService(ports);
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
    expect(ports.postSaleRecord).not.toHaveBeenCalled();
  });

  it("posts walk-in payments without customer ledger and rejects unpaid walk-in", async () => {
    const ports = basePorts();
    const service = new SaleTransactionService(ports);
    const result = await service.postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
      payments: [{ paymentMethodId: method, amount: 100 }],
      discounts: [],
      idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    expect(result.paidTotal).toBe(100);
    expect(result.remainingTotal).toBe(0);
    expect(ports.postCustomerSaleLedger).not.toHaveBeenCalled();
    expect(ports.postSplitPayment).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "sale", customerId: undefined }),
    );

    await expect(
      service.postSale({
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: method, amount: 40 }],
        discounts: [],
        idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      }),
    ).rejects.toThrow(/Walk-in sales must be paid in full/i);
  });
});
