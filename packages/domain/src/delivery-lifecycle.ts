import type { DeliveryStatus } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";
import { buildAuditRow } from "./audit-trail.js";

const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["packed", "cancelled"],
  packed: ["dispatched", "cancelled"],
  dispatched: ["in_transit", "delivered", "cancelled"],
  in_transit: ["delivered"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

/** Statuses that allow cancellation per business rules. */
const CANCELLABLE: DeliveryStatus[] = ["pending", "packed", "dispatched"];

export function assertDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (from === to) return;
  if (to === "cancelled" && !canCancelDelivery(from)) {
    throw new ValidationDomainError(`Delivery cannot be cancelled from status ${from}`);
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw new ValidationDomainError(`Invalid delivery transition ${from} → ${to}`);
  }
}

export function canCancelDelivery(status: DeliveryStatus): boolean {
  return CANCELLABLE.includes(status);
}

export function nextDeliveryStatuses(status: DeliveryStatus): DeliveryStatus[] {
  return [...TRANSITIONS[status]];
}

export function deliveryStatusTimestampField(
  status: DeliveryStatus,
): "packed_at" | "dispatched_at" | "in_transit_at" | "delivered_at" | "cancelled_at" | null {
  switch (status) {
    case "packed":
      return "packed_at";
    case "dispatched":
      return "dispatched_at";
    case "in_transit":
      return "in_transit_at";
    case "delivered":
      return "delivered_at";
    case "cancelled":
      return "cancelled_at";
    default:
      return null;
  }
}

export function buildDeliveryStatusAudit(input: {
  organizationId: string;
  branchId?: string | null;
  deliveryId: string;
  actorUserId?: string | null;
  fromStatus: DeliveryStatus;
  toStatus: DeliveryStatus;
  reason?: string | null;
}) {
  const action =
    input.toStatus === "cancelled"
      ? "delivery.cancel"
      : input.fromStatus === "pending" && input.toStatus === "packed"
        ? "delivery.pack"
        : "delivery.status_change";
  return buildAuditRow({
    organizationId: input.organizationId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    actorKind: input.toStatus === "cancelled" ? "canceller" : "editor",
    action,
    entityType: "delivery",
    entityId: input.deliveryId,
    before: { status: input.fromStatus },
    after: { status: input.toStatus },
    remarks: input.reason ?? undefined,
  });
}

export type DeliveryReportRow = {
  id: string;
  deliveryNumber: string;
  status: DeliveryStatus;
  deliveryBoyUserId?: string | null;
  deliveryBoyName?: string | null;
  createdAt: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  packedAt?: string | null;
  inTransitAt?: string | null;
};

export function summarizeDeliveryReports(rows: DeliveryReportRow[]) {
  const byStatus: Record<string, number> = {};
  const byBoy = new Map<string, { name?: string; count: number; delivered: number }>();
  const durations: number[] = [];

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (row.deliveryBoyUserId) {
      const boy = byBoy.get(row.deliveryBoyUserId) ?? {
        name: row.deliveryBoyName ?? undefined,
        count: 0,
        delivered: 0,
      };
      boy.count += 1;
      if (row.status === "delivered") boy.delivered += 1;
      byBoy.set(row.deliveryBoyUserId, boy);
    }
    if (row.dispatchedAt && row.deliveredAt) {
      const ms =
        new Date(row.deliveredAt).getTime() - new Date(row.dispatchedAt).getTime();
      if (ms > 0) durations.push(ms / (1000 * 60 * 60));
    }
  }

  const deliveryBoy = [...byBoy.entries()].map(([userId, v]) => ({
    deliveryBoyUserId: userId,
    deliveryBoyName: v.name,
    assigned: v.count,
    delivered: v.delivered,
  }));

  const avgHours =
    durations.length > 0
      ? Math.round((durations.reduce((s, h) => s + h, 0) / durations.length) * 100) / 100
      : 0;

  return {
    summary: {
      total: rows.length,
      byStatus,
      avgDispatchToDeliveredHours: avgHours,
      sampleSize: durations.length,
    },
    deliveryBoy,
    timeAnalysis: {
      avgDispatchToDeliveredHours: avgHours,
      samples: durations.length,
      minHours: durations.length ? Math.min(...durations) : 0,
      maxHours: durations.length ? Math.max(...durations) : 0,
    },
  };
}
