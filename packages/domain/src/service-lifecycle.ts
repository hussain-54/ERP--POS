import type { ServiceJobStatus } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

const TRANSITIONS: Record<ServiceJobStatus, ServiceJobStatus[]> = {
  received: ["diagnosis", "cancelled"],
  diagnosis: ["repairing", "ready", "cancelled"],
  repairing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function assertServiceJobTransition(from: ServiceJobStatus, to: ServiceJobStatus): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ValidationDomainError(`Invalid service job transition ${from} → ${to}`);
  }
}

export function computeServiceBill(input: {
  repairCost: number;
  serviceCharges: number;
  partsTotal: number;
  underWarranty: boolean;
}): { billableTotal: number; warrantyCovered: number } {
  const gross = Math.round((input.repairCost + input.serviceCharges + input.partsTotal) * 100) / 100;
  if (input.underWarranty) {
    return { billableTotal: 0, warrantyCovered: gross };
  }
  return { billableTotal: gross, warrantyCovered: 0 };
}
