import { describe, expect, it } from "vitest";
import { NullDeliveryTrackingAdapter, resolveTrackingSnapshot } from "./delivery-tracking.js";

describe("delivery-tracking", () => {
  it("null adapter reports not_configured without coordinates", () => {
    const port = new NullDeliveryTrackingAdapter();
    expect(port.integrationStatus).toBe("not_configured");
  });

  it("resolveTrackingSnapshot does not fabricate GPS data", async () => {
    const port = new NullDeliveryTrackingAdapter();
    const snap = await resolveTrackingSnapshot({
      trackingConfigured: false,
      port,
      deliveryId: "del-1",
    });
    expect(snap.integrationStatus).toBe("not_configured");
    expect(snap.message).toMatch(/not configured/i);

    const history = await port.getLocationHistory("del-1");
    expect(history).toEqual([]);
  });
});
