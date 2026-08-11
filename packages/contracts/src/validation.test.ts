import { describe, expect, it } from "vitest";
import { CreateJournalEntrySchema } from "./accounting.js";
import { LoginSchema } from "./user.js";
import { CreateSaleSchema } from "./sale.js";
import { MoneySchema, QuantitySchema, UuidSchema } from "./common.js";

const uuid = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";
const uuid3 = "33333333-3333-4333-8333-333333333333";
const uuid4 = "44444444-4444-4444-8444-444444444444";
const uuid5 = "55555555-5555-4555-8555-555555555555";

describe("shared validation", () => {
  it("accepts valid money and quantity", () => {
    expect(MoneySchema.parse(10.5)).toBe(10.5);
    expect(QuantitySchema.parse(1.25)).toBe(1.25);
  });

  it("rejects negative money and zero quantity", () => {
    expect(() => MoneySchema.parse(-1)).toThrow();
    expect(() => QuantitySchema.parse(0)).toThrow();
  });

  it("rejects invalid uuid", () => {
    expect(() => UuidSchema.parse("not-a-uuid")).toThrow();
  });

  it("validates login input", () => {
    expect(LoginSchema.parse({ email: "a@b.com", password: "password1" })).toBeTruthy();
    expect(() => LoginSchema.parse({ email: "bad", password: "short" })).toThrow();
  });

  it("validates sale create with payments", () => {
    const sale = CreateSaleSchema.parse({
      organizationId: uuid,
      branchId: uuid2,
      warehouseId: uuid3,
      items: [
        {
          productId: uuid4,
          unitId: uuid5,
          qty: 2,
          unitPrice: 100,
          discount: 0,
          tax: 0,
        },
      ],
      payments: [{ paymentMethodId: uuid, amount: 200 }],
      discountTotal: 0,
      idempotencyKey: uuid,
    });
    expect(sale.items).toHaveLength(1);
  });

  it("rejects unbalanced journal", () => {
    expect(() =>
      CreateJournalEntrySchema.parse({
        organizationId: uuid,
        entryDate: "2026-08-10",
        sourceType: "manual",
        sourceId: uuid2,
        idempotencyKey: uuid3,
        lines: [
          { accountId: uuid4, debit: 100, credit: 0 },
          { accountId: uuid5, debit: 0, credit: 50 },
        ],
      }),
    ).toThrow();
  });
});
