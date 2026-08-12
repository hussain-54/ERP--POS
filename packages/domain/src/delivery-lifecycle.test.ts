import { describe, expect, it } from "vitest";
import {
  assertDeliveryTransition,
  canCancelDelivery,
  nextDeliveryStatuses,
  summarizeDeliveryReports,
} from "./delivery-lifecycle.js";

describe("delivery-lifecycle", () => {
  it("allows Pending → Packed → Dispatched → In Transit → Delivered", () => {
    expect(() => assertDeliveryTransition("pending", "packed")).not.toThrow();
    expect(() => assertDeliveryTransition("packed", "dispatched")).not.toThrow();
    expect(() => assertDeliveryTransition("dispatched", "in_transit")).not.toThrow();
    expect(() => assertDeliveryTransition("in_transit", "delivered")).not.toThrow();
    expect(() => assertDeliveryTransition("dispatched", "delivered")).not.toThrow();
  });

  it("blocks invalid skips", () => {
    expect(() => assertDeliveryTransition("pending", "delivered")).toThrow(/transition/i);
    expect(() => assertDeliveryTransition("pending", "in_transit")).toThrow(/transition/i);
  });

  it("cancellation rules: allowed before in_transit, blocked after", () => {
    expect(canCancelDelivery("pending")).toBe(true);
    expect(canCancelDelivery("packed")).toBe(true);
    expect(canCancelDelivery("dispatched")).toBe(true);
    expect(canCancelDelivery("in_transit")).toBe(false);
    expect(canCancelDelivery("delivered")).toBe(false);

    expect(() => assertDeliveryTransition("pending", "cancelled")).not.toThrow();
    expect(() => assertDeliveryTransition("in_transit", "cancelled")).toThrow(/cannot be cancelled/i);
    expect(() => assertDeliveryTransition("delivered", "cancelled")).toThrow(/cannot be cancelled/i);
  });

  it("next statuses helper", () => {
    expect(nextDeliveryStatuses("dispatched")).toContain("in_transit");
    expect(nextDeliveryStatuses("cancelled")).toEqual([]);
  });

  it("delivery reports summarize by status, boy, and time", () => {
    const report = summarizeDeliveryReports([
      {
        id: "1",
        deliveryNumber: "DEL-1",
        status: "delivered",
        deliveryBoyUserId: "boy-1",
        deliveryBoyName: "Ali",
        createdAt: "2026-08-01T10:00:00Z",
        dispatchedAt: "2026-08-01T11:00:00Z",
        deliveredAt: "2026-08-01T13:00:00Z",
      },
      {
        id: "2",
        deliveryNumber: "DEL-2",
        status: "pending",
        deliveryBoyUserId: "boy-1",
        deliveryBoyName: "Ali",
        createdAt: "2026-08-02T10:00:00Z",
      },
    ]);
    expect(report.summary.total).toBe(2);
    expect(report.summary.byStatus.delivered).toBe(1);
    expect(report.deliveryBoy[0]?.assigned).toBe(2);
    expect(report.deliveryBoy[0]?.delivered).toBe(1);
    expect(report.timeAnalysis.avgDispatchToDeliveredHours).toBe(2);
  });
});
