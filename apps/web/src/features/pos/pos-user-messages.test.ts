import { describe, expect, it, vi } from "vitest";
import {
  formatPosFailure,
  humanizeCartError,
  looksLikeInfrastructureError,
  productSearchEmptyCopy,
  toPosUserDescription,
} from "./pos-user-messages";
import { formatOnlineFailure } from "@/lib/online-required";
import { stockAvailabilityWarning } from "./pos-ux";

describe("POS user messages", () => {
  it("detects Supabase / Postgres diagnostics as infrastructure errors", () => {
    expect(looksLikeInfrastructureError("PGRST116: not found")).toBe(true);
    expect(
      looksLikeInfrastructureError(
        'duplicate key value violates unique constraint "products_sku_key"',
      ),
    ).toBe(true);
    expect(looksLikeInfrastructureError("This product is out of stock")).toBe(false);
  });

  it("maps stock and payment domain errors into plain language", () => {
    expect(humanizeCartError("Product is out of stock")).toMatch(/insufficient stock/i);
    expect(humanizeCartError("Insufficient stock (available 2)")).toMatch(/insufficient stock/i);
    expect(toPosUserDescription("Walk-in sales must be paid in full", "fallback")).toMatch(
      /incomplete|walk-in/i,
    );
    expect(toPosUserDescription("Select a customer for partial / credit payment", "fallback")).toMatch(
      /customer required/i,
    );
  });

  it("never returns raw unique-constraint text to cashiers", () => {
    const msg = toPosUserDescription(
      'duplicate key value violates unique constraint "products_sku_key"',
      "Product could not be added because this SKU already exists.",
    );
    expect(msg).toBe("Product could not be added because this SKU already exists.");
    expect(msg).not.toMatch(/unique constraint/i);
  });

  it("formatPosFailure logs for developers and returns safe copy", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failed = formatPosFailure(new Error("PGRST301: JWT expired"), "payment");
    expect(failed.title).toMatch(/Payment/i);
    expect(failed.description).not.toMatch(/PGRST|JWT/i);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("formatOnlineFailure no longer leaks raw Postgres messages", () => {
    const failed = formatOnlineFailure(
      new Error("column stock_movements.operation_id does not exist"),
      "payment",
    );
    expect(failed.description).not.toMatch(/column|stock_movements/i);
    expect(failed.description).toMatch(/could not be completed/i);
  });

  it("explains empty product search clearly", () => {
    expect(productSearchEmptyCopy({ searchingCatalog: true, tab: "results", query: "abc" }).title).toBe(
      "No products found for this search.",
    );
  });

  it("uses clearer stock availability warnings", () => {
    expect(stockAvailabilityWarning("0", "1")).toMatch(/Out of stock/i);
    expect(stockAvailabilityWarning("1", "3")).toMatch(/Only 1 in stock/i);
    expect(stockAvailabilityWarning("2", "2")).toMatch(/Last 2/i);
  });
});
