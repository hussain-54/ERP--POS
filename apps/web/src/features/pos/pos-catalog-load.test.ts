import { describe, expect, it } from "vitest";
import {
  appendUniqueProducts,
  canViewMoreProducts,
  isLatestRequest,
  mergeProductSearches,
  nextProductSearchLimit,
  POS_PRODUCT_PAGE_SIZE,
  POS_PRODUCT_SEARCH_LIMIT,
  POS_PRODUCT_SEARCH_LIMIT_MAX,
  POS_SEARCH_FLUSH_MS,
  productImageUrl,
  productsMatchingCategory,
  visibleProductSlice,
} from "./pos-catalog-load";

describe("POS catalog load", () => {
  it("merges unique search hits in parallel instead of one name at a time", async () => {
    const started: string[] = [];
    const active = { count: 0, max: 0 };
    const items = await mergeProductSearches(["LED", "LED", "Wire"], async (q) => {
      started.push(q);
      active.count += 1;
      active.max = Math.max(active.max, active.count);
      await Promise.resolve();
      active.count -= 1;
      return [
        {
          productId: q === "LED" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: q,
          sku: q,
          unitId: "11111111-1111-4111-8111-111111111111",
          unitSymbolPlaces: 0,
          retailPrice: 1,
          wholesalePrice: 1,
          dealerPrice: 1,
          warrantyDays: 0,
        },
      ];
    });
    expect(started).toEqual(["LED", "Wire"]);
    expect(active.max).toBe(2);
    expect(items.map((item) => item.sku)).toEqual(["LED", "Wire"]);
  });

  it("keeps a single category-name search on products tagged with that category", () => {
    const wires = {
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Copper Wire",
      sku: "W-1",
      category: "Wires",
      unitId: "11111111-1111-4111-8111-111111111111",
      unitSymbolPlaces: 0,
      retailPrice: 1,
      wholesalePrice: 1,
      dealerPrice: 1,
      warrantyDays: 0,
    };
    const tape = {
      ...wires,
      productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Wires tape",
      sku: "T-1",
      category: "Tape",
    };
    expect(productsMatchingCategory([wires, tape], "Wires")).toEqual([wires]);
    expect(productsMatchingCategory([{ ...wires, category: null }], "Wires")).toHaveLength(1);
  });

  it("drops stale in-flight search generations", () => {
    expect(isLatestRequest(3, 3)).toBe(true);
    expect(isLatestRequest(4, 3)).toBe(false);
  });

  it("pages visible cards and raises the existing search limit without inventing a second API", () => {
    expect(POS_PRODUCT_PAGE_SIZE).toBe(12);
    expect(POS_SEARCH_FLUSH_MS).toBe(180);
    expect(POS_PRODUCT_SEARCH_LIMIT).toBe(24);
    expect(visibleProductSlice(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(canViewMoreProducts(13, 12)).toBe(true);
    expect(canViewMoreProducts(12, 12)).toBe(false);
    expect(canViewMoreProducts(12, 12, true)).toBe(true);
    expect(nextProductSearchLimit(POS_PRODUCT_SEARCH_LIMIT)).toBe(48);
    expect(nextProductSearchLimit(POS_PRODUCT_SEARCH_LIMIT_MAX)).toBe(50);
    const first = {
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "A",
      sku: "A",
      unitId: "11111111-1111-4111-8111-111111111111",
      unitSymbolPlaces: 0,
      retailPrice: 1,
      wholesalePrice: 1,
      dealerPrice: 1,
      warrantyDays: 0,
    };
    const second = { ...first, productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sku: "B" };
    expect(appendUniqueProducts([first], [first, second])).toHaveLength(2);
    expect(productImageUrl(first)).toBeNull();
    expect(productImageUrl({ ...first, imageUrl: "https://cdn.example/p.jpg" } as typeof first)).toBe(
      "https://cdn.example/p.jpg",
    );
    expect(productImageUrl({ ...first, imageUrl: "javascript:alert(1)" } as typeof first)).toBeNull();
  });
});
