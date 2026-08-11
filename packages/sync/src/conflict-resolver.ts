export type ConflictStrategy =
  | "server_wins"
  | "client_wins"
  | "latest_version"
  | "manual"
  | "transaction_reconcile";

export interface ConflictInput {
  entityType: string;
  serverVersion: number;
  clientVersion: number;
  serverUpdatedAt?: string;
  clientUpdatedAt?: string;
  strategy: ConflictStrategy;
}

export interface ConflictDecision {
  resolution: ConflictStrategy | "pending";
  winner: "server" | "client" | "both" | "none";
  reason: string;
}

/**
 * Configurable conflict resolution.
 * Financial/inventory prefer transaction_reconcile (apply both ops) over LWW.
 */
export function resolveConflict(input: ConflictInput): ConflictDecision {
  const isTransactional =
    input.entityType === "sales" ||
    input.entityType === "stock_movements" ||
    input.entityType === "payments" ||
    input.entityType === "sale_returns" ||
    input.entityType === "purchases";

  let strategy = input.strategy;
  if (isTransactional && strategy !== "manual") {
    strategy = "transaction_reconcile";
  }

  switch (strategy) {
    case "server_wins":
      return { resolution: "server_wins", winner: "server", reason: "Configured server wins" };
    case "client_wins":
      return { resolution: "client_wins", winner: "client", reason: "Configured client wins" };
    case "latest_version": {
      if (input.clientVersion === input.serverVersion) {
        const serverTs = Date.parse(input.serverUpdatedAt ?? "") || 0;
        const clientTs = Date.parse(input.clientUpdatedAt ?? "") || 0;
        if (clientTs === serverTs) {
          return { resolution: "pending", winner: "none", reason: "Equal version/time — manual" };
        }
        return clientTs > serverTs
          ? { resolution: "latest_version", winner: "client", reason: "Client newer timestamp" }
          : { resolution: "latest_version", winner: "server", reason: "Server newer timestamp" };
      }
      return input.clientVersion > input.serverVersion
        ? { resolution: "latest_version", winner: "client", reason: "Client higher version" }
        : { resolution: "latest_version", winner: "server", reason: "Server higher version" };
    }
    case "transaction_reconcile":
      return {
        resolution: "transaction_reconcile",
        winner: "both",
        reason: "Apply both transaction events; recompute stock from movements",
      };
    case "manual":
    default:
      return { resolution: "pending", winner: "none", reason: "Manual resolution required" };
  }
}

export function detectVersionConflict(
  serverVersion: number | undefined,
  clientVersion: number | undefined,
): boolean {
  if (serverVersion == null || clientVersion == null) return false;
  return serverVersion !== clientVersion && serverVersion > 0 && clientVersion > 0;
}
