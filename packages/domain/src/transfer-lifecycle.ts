import type { TransferStatus } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  requested: ["approved", "cancelled"],
  approved: ["dispatched", "cancelled"],
  dispatched: ["in_transit", "cancelled"],
  in_transit: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

export function assertTransferTransition(from: TransferStatus, to: TransferStatus): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ValidationDomainError(`Invalid transfer transition ${from} → ${to}`);
  }
}

/** Dispatch implies stock leaves source; receive implies stock enters destination. */
export function transferStockEffects(status: TransferStatus): {
  stockOut: boolean;
  stockIn: boolean;
} {
  return {
    stockOut: status === "dispatched" || status === "in_transit",
    stockIn: status === "received",
  };
}

export function nextTransferAfterDispatch(current: TransferStatus): TransferStatus {
  assertTransferTransition(current, "dispatched");
  return "in_transit";
}
