/**
 * Delivery live-tracking / GPS integration points.
 * Do not fabricate coordinates — adapters return integration state only.
 */

export type TrackingIntegrationStatus = "not_configured" | "unavailable" | "active";

export type DeliveryTrackingSnapshot = {
  integrationStatus: TrackingIntegrationStatus;
  provider?: string | null;
  reference?: string | null;
  lastKnownAt?: string | null;
  message: string;
};

export type DeliveryLocationPoint = {
  lat: number;
  lng: number;
  recordedAt: string;
  accuracyMeters?: number | null;
};

export interface DeliveryTrackingPort {
  readonly integrationStatus: TrackingIntegrationStatus;
  getSnapshot(deliveryId: string): Promise<DeliveryTrackingSnapshot>;
  getLocationHistory(deliveryId: string): Promise<DeliveryLocationPoint[]>;
}

/** Default when no external GPS/live-tracking provider is configured. */
export class NullDeliveryTrackingAdapter implements DeliveryTrackingPort {
  readonly integrationStatus: TrackingIntegrationStatus = "not_configured";

  async getSnapshot(_deliveryId: string): Promise<DeliveryTrackingSnapshot> {
    return {
      integrationStatus: "not_configured",
      message: "Live tracking is not configured. Connect a GPS provider to enable.",
    };
  }

  async getLocationHistory(_deliveryId: string): Promise<DeliveryLocationPoint[]> {
    return [];
  }
}

export function resolveTrackingSnapshot(input: {
  trackingConfigured?: boolean;
  trackingProvider?: string | null;
  trackingReference?: string | null;
  port: DeliveryTrackingPort;
  deliveryId: string;
}): Promise<DeliveryTrackingSnapshot> {
  if (!input.trackingConfigured) {
    return input.port.getSnapshot(input.deliveryId);
  }
  return input.port.getSnapshot(input.deliveryId).then((snap) => ({
    ...snap,
    integrationStatus: snap.integrationStatus === "not_configured" ? "unavailable" : snap.integrationStatus,
    provider: input.trackingProvider ?? snap.provider,
    reference: input.trackingReference ?? snap.reference,
    message:
      snap.integrationStatus === "active"
        ? "Live tracking provider connected."
        : "Tracking reference saved; live feed unavailable.",
  }));
}
