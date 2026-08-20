import { describe, expect, it } from "vitest";
import {
  estimateInvoiceRoundTrips,
  estimateSearchProductRoundTrips,
  posMountRequestBudget,
} from "./pos-performance-model";

describe("POS performance cost model", () => {
  it("shows legacy search N+1 grows with result count", () => {
    const legacy = estimateSearchProductRoundTrips({
      resultCount: 24,
      withWarehouse: true,
      withCustomerPrices: false,
      mode: "legacy-n1",
    });
    const batched = estimateSearchProductRoundTrips({
      resultCount: 24,
      withWarehouse: true,
      withCustomerPrices: false,
      mode: "batched",
    });
    expect(legacy).toBeGreaterThan(150);
    expect(batched).toBeLessThan(30);
    expect(batched).toBeLessThan(legacy / 5);
  });

  it("batches invoice line lookups", () => {
    const legacy = estimateInvoiceRoundTrips({ lineCount: 40, mode: "legacy-n1" });
    const batched = estimateInvoiceRoundTrips({ lineCount: 40, mode: "batched" });
    expect(legacy).toBe(88);
    expect(batched).toBe(10);
  });

  it("shell hold badge no longer forces expiry on every mount", () => {
    const before = posMountRequestBudget("before");
    const after = posMountRequestBudget("after");
    expect(before.holdListWithExpiry).toBe(1);
    expect(after.holdListWithExpiry).toBe(0);
    expect(after.holdListWithoutExpiry).toBe(1);
  });
});
