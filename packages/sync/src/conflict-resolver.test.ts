import { describe, expect, it } from "vitest";
import { detectVersionConflict, resolveConflict } from "./conflict-resolver.js";

describe("conflict resolver", () => {
  it("forces transaction reconcile for sales/stock/payments", () => {
    const d = resolveConflict({
      entityType: "sales",
      serverVersion: 2,
      clientVersion: 1,
      strategy: "server_wins",
    });
    expect(d.resolution).toBe("transaction_reconcile");
    expect(d.winner).toBe("both");
  });

  it("supports server/client/latest/manual for master data", () => {
    expect(
      resolveConflict({
        entityType: "customers",
        serverVersion: 2,
        clientVersion: 1,
        strategy: "server_wins",
      }).winner,
    ).toBe("server");
    expect(
      resolveConflict({
        entityType: "customers",
        serverVersion: 1,
        clientVersion: 2,
        strategy: "client_wins",
      }).winner,
    ).toBe("client");
    expect(
      resolveConflict({
        entityType: "products",
        serverVersion: 1,
        clientVersion: 3,
        strategy: "latest_version",
      }).winner,
    ).toBe("client");
    expect(
      resolveConflict({
        entityType: "customers",
        serverVersion: 1,
        clientVersion: 1,
        strategy: "manual",
      }).resolution,
    ).toBe("pending");
  });

  it("detects version conflicts", () => {
    expect(detectVersionConflict(2, 1)).toBe(true);
    expect(detectVersionConflict(1, 1)).toBe(false);
  });
});
