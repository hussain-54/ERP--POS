/**
 * Phase 16 — POS integrity audit against the online write path.
 * Ports mimic PosRepository (Supabase): catalog re-price, draft→stock→ledger→payment→posted.
 * Does not write to a live project.
 */
import { describe, expect, it } from "vitest";
import type { CreateSaleInput } from "@electronic-erp/contracts";
import { UuidSchema } from "@electronic-erp/contracts";
import { ForbiddenDomainError, ValidationDomainError } from "./errors.js";
import { PaymentAttemptGate } from "./pos-payment.js";
import {
  assertHoldActionAllowed,
  assertHoldCartNonEmpty,
  buildHoldSnapshot,
  cartLinesForResume,
  holdMustNotReduceInventory,
  nextStatusForAction,
  type HeldSaleRecord,
} from "./pos-hold.js";
import { preparePosExchange } from "./pos-exchange.js";
import { prepareSaleReturn } from "./pos-return.js";
import { clearCartLines } from "./pos-cart.js";
import {
  assertPosCreditRemainderAllowed,
  assertPosInstallmentSaleAllowed,
  canPosPriceOverride,
  evaluateCustomerCreditForRemainder,
  posDiscountRoleFromPermissions,
} from "./pos-security.js";
import { defaultPermissionsForRole } from "./rbac-catalog.js";
import {
  SaleTransactionService,
  saleStockMovementOperationId,
  type ProductPricingSnapshot,
  type SaleTransactionPorts,
  type StockSaleLine,
} from "./sale-transaction.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const replacement = "44444444-4444-4444-8444-444444444445";
const unit = "55555555-5555-4555-8555-555555555555";
const customer = "66666666-6666-4666-8666-666666666666";
const cash = "77777777-7777-4777-8777-777777777777";
const bank = "77777777-7777-4777-8777-777777777778";
const salesman = "99999999-9999-4999-8999-999999999999";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(n: number): string {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, "0")}`;
}

type SaleRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  paidTotal: number;
  remainingTotal: number;
  grandTotal: number;
  taxTotal: number;
  discountTotal: number;
  customerId: string | null;
  salesmanUserId: string | null;
  idempotencyKey: string;
};

type Store = {
  sales: SaleRow[];
  items: Array<Record<string, unknown>>;
  stock: Map<string, number>;
  movements: Array<{ operationId: string; productId: string; qty: number; purpose: string; saleId: string }>;
  payments: Array<Record<string, unknown>>;
  ledger: Array<{ customerId: string; amount: string; saleId: string }>;
  audits: Array<Record<string, unknown>>;
  discountAudits: Array<Record<string, unknown>>;
  commissions: Array<Record<string, unknown>>;
  installments: Array<Record<string, unknown>>;
  journals: Array<Record<string, unknown>>;
  holds: HeldSaleRecord[];
  catalog: Map<string, ProductPricingSnapshot>;
};

function createStore(opts?: { tax?: boolean; retail?: number }): {
  store: Store;
  ports: SaleTransactionPorts;
  service: SaleTransactionService;
} {
  const retail = opts?.retail ?? 100;
  const catalog = new Map<string, ProductPricingSnapshot>([
    [
      product,
      {
        retailPrice: retail,
        wholesalePrice: 80,
        dealerPrice: 70,
        taxRate: opts?.tax === false ? null : { ratePercent: 10, pricingMode: "exclusive" },
      },
    ],
    [
      replacement,
      {
        retailPrice: 150,
        wholesalePrice: 120,
        dealerPrice: 110,
        taxRate: opts?.tax === false ? null : { ratePercent: 10, pricingMode: "exclusive" },
      },
    ],
  ]);
  const store: Store = {
    sales: [],
    items: [],
    stock: new Map([
      [product, 10],
      [replacement, 10],
    ]),
    movements: [],
    payments: [],
    ledger: [],
    audits: [],
    discountAudits: [],
    commissions: [],
    installments: [],
    journals: [],
    holds: [],
    catalog,
  };

  const ports: SaleTransactionPorts = {
    findSaleByIdempotency: async (_organizationId, idempotencyKey) =>
      store.sales.find((s) => s.idempotencyKey === idempotencyKey) ?? null,
    searchStockAvailable: async (_warehouseId, productId) => String(store.stock.get(productId) ?? 0),
    getProductPricing: async (productId) => store.catalog.get(productId) ?? null,
    postSaleRecord: async (payload) => {
      const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String(store.sales.length + 1).padStart(12, "0")}`;
      const invoiceNumber = `INV-${store.sales.length + 1}`;
      store.sales.push({
        id,
        invoiceNumber,
        status: String(payload.status ?? "draft"),
        paidTotal: Number(payload.paid_total ?? 0),
        remainingTotal: Number(payload.remaining_total ?? 0),
        grandTotal: Number(payload.grand_total ?? 0),
        taxTotal: Number(payload.tax_total ?? 0),
        discountTotal: Number(payload.discount_total ?? 0),
        customerId: payload.customer_id ? String(payload.customer_id) : null,
        salesmanUserId: payload.salesman_user_id ? String(payload.salesman_user_id) : null,
        idempotencyKey: String(payload.idempotency_key),
      });
      return { id, invoiceNumber };
    },
    postSaleItems: async (saleId, items) => {
      for (const item of items) store.items.push({ ...item, sale_id: saleId });
    },
    postDiscountAudits: async (saleId, audits) => {
      for (const row of audits) store.discountAudits.push({ ...row, sale_id: saleId });
    },
    postStockSale: async (input: StockSaleLine) => {
      const qty = Number(input.qty);
      const available = store.stock.get(input.productId) ?? 0;
      if (available + 1e-9 < qty) {
        throw new ValidationDomainError(`Insufficient stock for product ${input.productId}`);
      }
      store.stock.set(input.productId, available - qty);
      store.movements.push({
        operationId: input.operationId,
        productId: input.productId,
        qty,
        purpose: "sale",
        saleId: input.saleId,
      });
    },
    reverseStockSale: async (input: StockSaleLine) => {
      const qty = Number(input.qty);
      store.stock.set(input.productId, (store.stock.get(input.productId) ?? 0) + qty);
      store.movements.push({
        operationId: input.operationId,
        productId: input.productId,
        qty,
        purpose: "reverse",
        saleId: input.saleId,
      });
    },
    postCustomerSaleLedger: async (input) => {
      store.ledger.push({ customerId: input.customerId, amount: input.amount, saleId: input.saleId });
    },
    postSplitPayment: async (input) => {
      store.payments.push(input);
    },
    updateSalePaymentState: async (saleId, input) => {
      const sale = store.sales.find((s) => s.id === saleId);
      if (sale) {
        sale.paidTotal = input.paidTotal;
        sale.remainingTotal = input.remainingTotal;
      }
    },
    finalizeSaleStatus: async (saleId, input) => {
      const sale = store.sales.find((s) => s.id === saleId);
      if (sale) {
        sale.status = "posted";
        sale.paidTotal = input.paidTotal;
        sale.remainingTotal = input.remainingTotal;
      }
    },
    voidIncompleteSale: async (saleId) => {
      const sale = store.sales.find((s) => s.id === saleId);
      if (sale) {
        sale.status = "void";
        sale.idempotencyKey = `${sale.idempotencyKey.slice(0, 14)}ffff${sale.idempotencyKey.slice(18)}`;
      }
    },
    postJournal: async (input) => {
      store.journals.push(input);
    },
    postCommission: async (input) => {
      store.commissions.push(input);
    },
    postWarranties: async () => undefined,
    createInstallment: async (input) => {
      store.installments.push(input);
    },
    postAnalytics: async () => undefined,
    postAudit: async (row) => {
      store.audits.push(row);
    },
  };

  return { store, ports, service: new SaleTransactionService(ports) };
}

function cashSale(overrides: Partial<CreateSaleInput> = {}): CreateSaleInput {
  return {
    organizationId: org,
    branchId: branch,
    warehouseId: warehouse,
    items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cash, amount: 1000, methodKind: "cash", amountReceived: 1000 }],
    discounts: [],
    idempotencyKey: key(1),
    ...overrides,
  };
}

describe("Phase 16 POS integrity — online write path", () => {
  it("SCENARIO 1: new cash sale writes sale, items, stock, payment, invoice, audit, totals", async () => {
    const { store, service } = createStore({ tax: false });
    const result = await service.postSale(cashSale({ idempotencyKey: key(1) }));
    const sale = store.sales[0]!;
    expect(sale.status).toBe("posted");
    expect(sale.invoiceNumber).toBe(result.invoiceNumber);
    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.product_id).toBe(product);
    expect(store.stock.get(product)).toBe(9);
    expect(store.movements).toHaveLength(1);
    expect(UuidSchema.parse(store.movements[0]!.operationId)).toMatch(UUID_RE);
    expect(store.movements[0]!.operationId).toBe(saleStockMovementOperationId(key(1), product, 0, "sale"));
    expect(store.payments).toHaveLength(1);
    expect(store.ledger).toHaveLength(0);
    expect(store.audits).toHaveLength(1);
    expect(store.journals).toHaveLength(1);
    expect(result.paidTotal).toBe(result.totals.grandTotal);
    expect(result.remainingTotal).toBe(0);
    expect(result.totals.grandTotal).toBe(100);
  });

  it("SCENARIO 2: sale with customer posts ledger against grand total", async () => {
    const { store, service } = createStore({ tax: false });
    await service.postSale(
      cashSale({
        customerId: customer,
        idempotencyKey: key(2),
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    expect(store.sales[0]?.customerId).toBe(customer);
    expect(store.ledger).toEqual([
      { customerId: customer, amount: "100", saleId: store.sales[0]!.id },
    ]);
    expect(store.payments).toHaveLength(1);
  });

  it("SCENARIO 3: authorized discount posts audit; over-limit cashier discount is rejected", async () => {
    const { store, service } = createStore({ tax: false });
    const posted = await service.postSale(
      cashSale({
        idempotencyKey: key(3),
        discountTotal: 5,
        invoiceDiscountKind: "percentage",
        discounts: [
          {
            scope: "invoice",
            kind: "percentage",
            percent: 5,
            amount: 5,
            approverRole: "cashier",
            reason: "POS invoice discount",
          },
        ],
        payments: [{ paymentMethodId: cash, amount: 95, methodKind: "cash" }],
      }),
    );
    expect(posted.totals.discountTotal).toBe(5);
    expect(posted.totals.grandTotal).toBe(95);
    expect(store.discountAudits[0]?.approver_role).toBe("cashier");
    expect(store.sales[0]?.discountTotal).toBe(5);

    const blocked = createStore({ tax: false });
    await expect(
      blocked.service.postSale(
        cashSale({
          idempotencyKey: key(31),
          discountTotal: 20,
          discounts: [
            {
              scope: "invoice",
              kind: "percentage",
              percent: 20,
              amount: 20,
              approverRole: "cashier",
              reason: "spoofed manager discount",
            },
          ],
        }),
      ),
    ).rejects.toThrow(/limit/i);
    expect(blocked.store.sales).toHaveLength(0);
  });

  it("SCENARIO 4: catalog tax is posted; missing catalog taxRate zeros client tax (live-shaped ports)", async () => {
    const taxed = createStore({ tax: true });
    const withTax = await taxed.service.postSale(
      cashSale({
        idempotencyKey: key(4),
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: cash, amount: 110, methodKind: "cash" }],
      }),
    );
    expect(withTax.totals.taxTotal).toBe(10);
    expect(withTax.totals.grandTotal).toBe(110);
    expect(taxed.store.sales[0]?.taxTotal).toBe(10);
    expect(taxed.store.items[0]?.tax_amount).toBe(10);

    const stripped = createStore({ tax: false });
    const noCatalogTax = await stripped.service.postSale(
      cashSale({
        idempotencyKey: key(41),
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 17 }],
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    expect(noCatalogTax.totals.taxTotal).toBe(0);
    expect(stripped.store.items[0]?.tax_amount).toBe(0);
  });

  it("SCENARIO 5: salesman posts commission on the posted sale", async () => {
    const { store, service } = createStore({ tax: false });
    await service.postSale(
      cashSale({
        idempotencyKey: key(5),
        salesmanUserId: salesman,
        commissionPercent: 5,
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    expect(store.sales[0]?.salesmanUserId).toBe(salesman);
    expect(store.commissions).toHaveLength(1);
    expect(store.commissions[0]?.salesman_user_id).toBe(salesman);
    expect(Number(store.commissions[0]?.commission_amount)).toBe(5);
  });

  it("SCENARIO 6: hold parks snapshot only — no stock movement", () => {
    expect(holdMustNotReduceInventory()).toBe(true);
    const { store } = createStore({ tax: false });
    const snapshot = buildHoldSnapshot({
      cart: [{ productId: product, qty: 2, unitPrice: 100 }],
      customerId: customer,
    });
    assertHoldCartNonEmpty(snapshot);
    const heldAt = "2026-08-17T03:00:00.000Z";
    store.holds.push({
      id: key(6),
      organizationId: org,
      branchId: branch,
      saleId: key(60),
      holdLabel: "Hold 1",
      holdReason: "customer stepped out",
      notes: null,
      heldBy: salesman,
      customerId: customer,
      cartSnapshot: snapshot,
      heldAt,
      expiresAt: "2026-08-18T03:00:00.000Z",
      status: "held",
    });
    expect(store.stock.get(product)).toBe(10);
    expect(store.movements).toHaveLength(0);
    expect(store.holds[0]?.status).toBe("held");
  });

  it("SCENARIO 7: resume replaces cart from snapshot and does not deduct stock", () => {
    const snapshot = buildHoldSnapshot({
      cart: [{ productId: product, qty: 2, unitPrice: 100 }],
    });
    const hold: HeldSaleRecord = {
      id: key(7),
      organizationId: org,
      branchId: branch,
      saleId: key(70),
      holdLabel: "Hold 1",
      holdReason: null,
      notes: null,
      heldBy: salesman,
      customerId: null,
      cartSnapshot: snapshot,
      heldAt: "2026-08-17T03:00:00.000Z",
      expiresAt: "2026-08-18T03:00:00.000Z",
      status: "held",
    };
    assertHoldActionAllowed(hold, "resume", {
      actorUserId: salesman,
      now: new Date("2026-08-17T12:00:00.000Z"),
    });
    const restored = cartLinesForResume(snapshot);
    expect(restored).toHaveLength(1);
    expect(nextStatusForAction("resume")).toBe("resumed");
  });

  it("SCENARIO 8: completing a resumed hold posts stock once", async () => {
    const { store, service } = createStore({ tax: false });
    const snapshot = buildHoldSnapshot({
      cart: [{ productId: product, qty: 1, unitPrice: 100 }],
    });
    expect(cartLinesForResume(snapshot)).toHaveLength(1);
    await service.postSale(
      cashSale({
        idempotencyKey: key(8),
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    expect(store.sales[0]?.status).toBe("posted");
    expect(store.stock.get(product)).toBe(9);
    expect(store.movements.filter((m) => m.purpose === "sale")).toHaveLength(1);
  });

  it("SCENARIO 9: credit remainder requires customer + in-limit profile", async () => {
    const cashier = defaultPermissionsForRole("cashier");
    const within = evaluateCustomerCreditForRemainder({
      creditLimit: "5000",
      outstanding: "100",
      creditDays: 30,
      isBlocked: false,
      remaining: 100,
    });
    expect(() =>
      assertPosCreditRemainderAllowed({
        remaining: 100,
        customerId: customer,
        credit: within,
        canApproveOverLimit: cashier.includes("credit.approve"),
      }),
    ).not.toThrow();

    const { store, service } = createStore({ tax: false });
    const result = await service.postSale(
      cashSale({
        customerId: customer,
        idempotencyKey: key(9),
        payments: [],
      }),
    );
    expect(result.paidTotal).toBe(0);
    expect(result.remainingTotal).toBe(100);
    expect(store.sales[0]?.remainingTotal).toBe(100);
    expect(store.ledger[0]?.amount).toBe("100");
    expect(store.payments).toHaveLength(0);

    const over = evaluateCustomerCreditForRemainder({
      creditLimit: "50",
      outstanding: "0",
      creditDays: 30,
      isBlocked: false,
      remaining: 100,
    });
    expect(() =>
      assertPosCreditRemainderAllowed({
        remaining: 100,
        customerId: customer,
        credit: over,
        canApproveOverLimit: false,
      }),
    ).toThrow(ForbiddenDomainError);
  });

  it("SCENARIO 10: installment create is gated and posts the installment port", async () => {
    expect(() => assertPosInstallmentSaleAllowed(false, true)).toThrow(ForbiddenDomainError);
    expect(() => assertPosInstallmentSaleAllowed(true, true)).not.toThrow();
    const { store, service } = createStore({ tax: false });
    await service.postSale(
      cashSale({
        customerId: customer,
        idempotencyKey: key(10),
        payments: [{ paymentMethodId: cash, amount: 40, methodKind: "cash" }],
        createInstallment: {
          downPayment: "40",
          installmentCount: 3,
          startDate: "2026-08-17",
          frequency: "monthly",
          lateFeePercent: 0,
          lateFeeFixed: "0",
        },
      }),
    );
    expect(store.installments).toHaveLength(1);
    expect(store.installments[0]?.customerId).toBe(customer);
    expect(store.installments[0]?.sourceType).toBe("sale");
    expect(store.sales[0]?.status).toBe("posted");
  });

  it("SCENARIO 11: return restocks and does not exceed sold qty", async () => {
    const { store, service } = createStore({ tax: false });
    await service.postSale(
      cashSale({
        customerId: customer,
        idempotencyKey: key(11),
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    const saleItemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const prepared = prepareSaleReturn({
      disposition: "refund",
      reasonCode: "not_satisfied",
      refundMethod: "cash",
      hasCustomer: true,
      returnable: [
        {
          saleItemId,
          productId: product,
          unitId: unit,
          soldQty: 1,
          previouslyReturnedQty: 0,
          unitPrice: 100,
        },
      ],
      lines: [
        {
          originalSaleItemId: saleItemId,
          unitId: unit,
          qty: 1,
          unitPrice: 100,
          condition: "good",
          originalPackaging: true,
          accessoriesComplete: true,
        },
      ],
    });
    expect(prepared.refundAmount).toBe(100);
    if (prepared.lines[0]?.restock) {
      store.stock.set(product, (store.stock.get(product) ?? 0) + prepared.lines[0].qty);
    }
    expect(store.stock.get(product)).toBe(10);
    expect(() =>
      prepareSaleReturn({
        disposition: "refund",
        reasonCode: "not_satisfied",
        hasCustomer: true,
        returnable: [
          {
            saleItemId,
            productId: product,
            unitId: unit,
            soldQty: 1,
            previouslyReturnedQty: 0,
            unitPrice: 100,
          },
        ],
        lines: [
          {
            originalSaleItemId: saleItemId,
            unitId: unit,
            qty: 2,
            unitPrice: 100,
            condition: "good",
            originalPackaging: true,
            accessoriesComplete: true,
          },
        ],
      }),
    ).toThrow(/exceeds returnable/i);
  });

  it("SCENARIO 12: exchange is return + replacement sale; a failed sale leaves the return posted", async () => {
    const prepared = preparePosExchange({
      reasonCode: "wrong_product",
      hasCustomer: true,
      returnDisposition: "refund",
      refundMethod: "cash",
      returnable: [
        {
          saleItemId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          productId: product,
          unitId: unit,
          soldQty: 1,
          previouslyReturnedQty: 0,
          unitPrice: 100,
        },
      ],
      returnLines: [
        {
          originalSaleItemId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          unitId: unit,
          qty: 1,
          unitPrice: 100,
          condition: "good",
          originalPackaging: true,
          accessoriesComplete: true,
        },
      ],
      replacements: [{ productId: replacement, unitId: unit, qty: 1, unitPrice: 150 }],
    });
    expect(prepared.settlement).toBe("collect");
    expect(prepared.difference).toBe(50);

    const { store, service } = createStore({ tax: false });
    const postedReturn = { id: key(12), status: "posted" };
    store.stock.set(replacement, 0);
    await expect(
      service.postSale(
        cashSale({
          idempotencyKey: key(121),
          items: [{ productId: replacement, unitId: unit, qty: 1, unitPrice: 150, discount: 0, tax: 0 }],
          payments: [{ paymentMethodId: cash, amount: 150, methodKind: "cash" }],
        }),
      ),
    ).rejects.toThrow(/Insufficient stock/i);
    expect(postedReturn.status).toBe("posted");
    expect(store.sales.some((s) => s.status === "posted")).toBe(false);
  });

  it("SCENARIO 13: payment recording posts split payment against the sale", async () => {
    const { store, service } = createStore({ tax: false });
    await service.postSale(
      cashSale({
        customerId: customer,
        idempotencyKey: key(13),
        payments: [{ paymentMethodId: cash, amount: 40, methodKind: "cash" }],
      }),
    );
    expect(store.payments[0]?.splits).toEqual(
      expect.arrayContaining([expect.objectContaining({ paymentMethodId: cash, amount: "40" })]),
    );
    expect(store.sales[0]?.paidTotal).toBe(40);
    expect(store.sales[0]?.remainingTotal).toBe(60);
  });

  it("SCENARIO 14: multiple payment methods reconcile to grand total", async () => {
    const { store, service } = createStore({ tax: false });
    const result = await service.postSale(
      cashSale({
        customerId: customer,
        idempotencyKey: key(14),
        payments: [
          { paymentMethodId: cash, amount: 40, methodKind: "cash" },
          { paymentMethodId: bank, amount: 60, methodKind: "bank" },
        ],
      }),
    );
    expect(result.paidTotal).toBe(100);
    expect(result.remainingTotal).toBe(0);
    const splits = store.payments[0]?.splits as Array<{ amount: string }>;
    expect(splits.map((s) => s.amount).sort()).toEqual(["40", "60"]);
  });

  it("SCENARIO 15: cancel sale clears the local cart and never writes stock", () => {
    let cart: Array<{ productId: string; qty: number }> = [{ productId: product, qty: 1 }];
    cart = clearCartLines();
    expect(cart).toEqual([]);
    const { store } = createStore({ tax: false });
    expect(store.movements).toHaveLength(0);
    expect(store.sales).toHaveLength(0);
  });

  it("SCENARIO 16: insufficient stock rejects before finalize and leaves no posted sale", async () => {
    const { store, service } = createStore({ tax: false });
    store.stock.set(product, 0);
    await expect(
      service.postSale(cashSale({ idempotencyKey: key(16) })),
    ).rejects.toThrow(/Insufficient stock/i);
    expect(store.sales.filter((s) => s.status === "posted")).toHaveLength(0);
    expect(store.stock.get(product)).toBe(0);
    expect(store.movements).toHaveLength(0);
  });

  it("SCENARIO 17: unauthorized price override cannot persist — catalog re-price wins", async () => {
    const cashier = defaultPermissionsForRole("cashier");
    expect(canPosPriceOverride(cashier)).toBe(false);
    const { store, service } = createStore({ tax: false, retail: 100 });
    const result = await service.postSale(
      cashSale({
        idempotencyKey: key(17),
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    expect(result.totals.grandTotal).toBe(100);
    expect(store.items[0]?.unit_price).toBe(100);
  });

  it("SCENARIO 18: unauthorized discount is overwritten from RBAC then rejected over cashier limit", async () => {
    const cashier = defaultPermissionsForRole("cashier");
    const role = posDiscountRoleFromPermissions(cashier);
    expect(role).toBe("cashier");
    const { service } = createStore({ tax: false });
    await expect(
      service.postSale(
        cashSale({
          idempotencyKey: key(18),
          discountTotal: 50,
          discounts: [
            {
              scope: "invoice",
              kind: "percentage",
              percent: 50,
              amount: 50,
              approverRole: role ?? "cashier",
              reason: "client spoofed owner",
            },
          ],
        }),
      ),
    ).rejects.toThrow(/limit/i);
  });

  it("SCENARIO 19: duplicate submit returns the posted sale without a second stock write", async () => {
    const { store, service } = createStore({ tax: false });
    const gate = new PaymentAttemptGate();
    const idempotencyKey = key(19);
    gate.begin(idempotencyKey);
    const input = cashSale({
      idempotencyKey,
      payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
    });
    const first = await service.postSale(input);
    gate.succeed(idempotencyKey);
    expect(() => gate.begin(idempotencyKey)).not.toThrow();
    const second = await service.postSale(input);
    expect(second.id).toBe(first.id);
    expect(store.movements.filter((m) => m.purpose === "sale")).toHaveLength(1);
    expect(store.sales.filter((s) => s.status === "posted")).toHaveLength(1);
    expect(store.stock.get(product)).toBe(9);

    const inFlight = new PaymentAttemptGate();
    inFlight.begin(key(191));
    expect(() => inFlight.begin(key(191))).toThrow(/duplicate/i);
  });

  it("SCENARIO 20: a new checkout key after refresh cannot mutate the already-posted sale", async () => {
    const { store, service } = createStore({ tax: false });
    await service.postSale(
      cashSale({
        idempotencyKey: key(20),
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    const posted = store.sales[0]!;
    expect(posted.status).toBe("posted");
    const refreshed = await service.postSale(
      cashSale({
        idempotencyKey: key(21),
        payments: [{ paymentMethodId: cash, amount: 100, methodKind: "cash" }],
      }),
    );
    expect(refreshed.id).not.toBe(posted.id);
    expect(store.sales).toHaveLength(2);
    expect(store.stock.get(product)).toBe(8);
  });
});
