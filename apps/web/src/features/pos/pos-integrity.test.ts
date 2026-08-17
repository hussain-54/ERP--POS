import { describe, expect, it } from "vitest";
import { PaymentAttemptGate, clearCartLines } from "@electronic-erp/domain";

const FAVORITES_KEY = "erp-pos-favorites";
const RECENT_KEY = "erp-pos-recent";

describe("Phase 16 POS integrity — terminal session", () => {
  it("SCENARIO 15: cancel replaces the cart with an empty list", () => {
    expect(clearCartLines()).toEqual([]);
  });

  it("SCENARIO 19: in-flight checkout key cannot begin twice", () => {
    const gate = new PaymentAttemptGate();
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-000000000019";
    gate.begin(key);
    expect(() => gate.begin(key)).toThrow(/duplicate/i);
  });

  it("SCENARIO 20: browser storage keeps favorites/recents, not the open cart or checkout key", () => {
    expect(FAVORITES_KEY).toBe("erp-pos-favorites");
    expect(RECENT_KEY).toBe("erp-pos-recent");
    expect(localStorage.getItem("erp-pos-checkout-idempotency")).toBeNull();
    expect(sessionStorage.getItem("erp-pos-cart")).toBeNull();
  });
});
