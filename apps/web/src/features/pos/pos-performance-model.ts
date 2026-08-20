/**
 * Static POS performance cost model (round-trips), used to measure before/after
 * without inventing runtime timings. Counts Supabase-style request units.
 */

export type PosMountRequestBudget = {
  /** Parallel-friendly bootstrap calls from PosPage + POSShell status. */
  bootstrapApis: number;
  /** listHolds calls that also run expireDueHolds by default. */
  holdListWithExpiry: number;
  /** listHolds calls that skip expiry (header badge). */
  holdListWithoutExpiry: number;
};

export function estimateSearchProductRoundTrips(input: {
  resultCount: number;
  withWarehouse: boolean;
  withCustomerPrices: boolean;
  mode: "legacy-n1" | "batched";
}): number {
  const n = Math.max(0, input.resultCount);
  if (input.mode === "legacy-n1") {
    // products + barcodes + qrs + 4 taxonomy + specs + optional taxonomy products
    // + per missing barcode/spec product fetch (amortized as 0..n; use n/4 mid)
    // + per result: stock + brand + company + category + model + spec + unit
    const discovery = 1 + 1 + 1 + 4 + 1 + 1; // 9
    const perProduct = (input.withWarehouse ? 1 : 0) + 6;
    const customer = input.withCustomerPrices && n > 0 ? 1 : 0;
    return discovery + n * perProduct + customer;
  }
  // Parallel discovery (counted as concurrent waves, still multiple requests):
  // wave1: products, barcodes, qrs, 4 taxonomy, specs = 8
  // wave2: missing products by id (0|1), taxonomy products (0|1) = up to 2
  // wave3: brands, companies, categories, models, units, specs, balances = up to 7
  // wave4: customer prices = 0|1
  const discovery = 8;
  const followUp = 2;
  const hydrate = 6 + (input.withWarehouse ? 1 : 0);
  const customer = input.withCustomerPrices && n > 0 ? 1 : 0;
  return discovery + followUp + hydrate + customer;
}

export function estimateInvoiceRoundTrips(input: {
  lineCount: number;
  mode: "legacy-n1" | "batched";
}): number {
  const lines = Math.max(0, input.lineCount);
  // sale + items + customer + branch + cashier + salesman + commission + payments
  const header = 8;
  if (input.mode === "legacy-n1") {
    return header + lines * 2; // product + unit per line
  }
  return header + (lines > 0 ? 2 : 0); // one products.in + one units.in
}

export function posMountRequestBudget(mode: "before" | "after"): PosMountRequestBudget {
  if (mode === "before") {
    return {
      // seedPaymentMethods, warehouses, employees, references, taxRates,
      // shell: listHolds(+expiry), currentShift, listBranches, devices
      bootstrapApis: 9,
      holdListWithExpiry: 1, // shell badge
      holdListWithoutExpiry: 0,
    };
  }
  return {
    bootstrapApis: 9, // same APIs, but TTL/dedupe prevents repeat within session
    holdListWithExpiry: 0,
    holdListWithoutExpiry: 1, // shell badge skips expire
  };
}
