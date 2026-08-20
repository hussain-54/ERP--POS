import { describe, expect, it } from "vitest";
import { cachedPosFetch, clearPosBootstrapCache } from "./pos-bootstrap-cache";

describe("cachedPosFetch", () => {
  it("dedupes in-flight identical keys and reuses TTL hits", async () => {
    clearPosBootstrapCache();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true, calls };
    };
    const [a, b] = await Promise.all([
      cachedPosFetch("warehouses", loader),
      cachedPosFetch("warehouses", loader),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    const c = await cachedPosFetch("warehouses", loader);
    expect(calls).toBe(1);
    expect(c.ok).toBe(true);
  });
});
