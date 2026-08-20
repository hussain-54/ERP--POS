import { describe, expect, it } from "vitest";
import { ConflictDomainError, ValidationDomainError } from "@electronic-erp/domain";
import { conflictMessageForDbError, mapSupabaseError } from "./supabase-error.js";

describe("mapSupabaseError", () => {
  it("maps duplicate SKU to a conflict", () => {
    const err = mapSupabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "products_organization_id_sku_key"',
      details: "Key (organization_id, sku)=(org, ABC) already exists.",
    });
    expect(err).toBeInstanceOf(ConflictDomainError);
    expect(err.message).toBe("A product with this SKU already exists");
  });

  it("maps duplicate barcode to a conflict", () => {
    const err = mapSupabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "barcodes_organization_id_code_key"',
      details: "Key (organization_id, code)=(org, 123) already exists.",
    });
    expect(err).toBeInstanceOf(ConflictDomainError);
    expect(err.message).toBe("A product with this barcode already exists");
  });

  it("maps missing FK to a validation error", () => {
    const err = mapSupabaseError({
      code: "23503",
      message: "insert or update on table \"products\" violates foreign key constraint",
    });
    expect(err).toBeInstanceOf(ValidationDomainError);
  });

  it("does not swallow unknown database errors", () => {
    const err = mapSupabaseError({ code: "XX000", message: "disk full" });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("disk full");
    expect(err).not.toBeInstanceOf(ConflictDomainError);
  });
});

describe("conflictMessageForDbError", () => {
  it("detects product code uniqueness", () => {
    expect(
      conflictMessageForDbError({
        message: "duplicate key",
        details: "Key (organization_id, product_code)=(x, P-1) already exists.",
      }),
    ).toBe("A product with this product code already exists");
  });
});
