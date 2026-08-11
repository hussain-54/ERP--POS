import type { DeliveryStatus } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["packed", "cancelled"],
  packed: ["dispatched", "cancelled"],
  dispatched: ["delivered", "returned", "cancelled"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export function assertDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ValidationDomainError(`Invalid delivery transition ${from} → ${to}`);
  }
}
