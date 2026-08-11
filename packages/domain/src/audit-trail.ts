export type AuditActorKind =
  | "creator"
  | "editor"
  | "deleter"
  | "approver"
  | "canceller"
  | "discount_giver"
  | "payment_receiver"
  | "stock_adjuster"
  | "other";

export interface AuditEntryInput {
  organizationId: string;
  branchId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  actorKind?: AuditActorKind;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  deviceId?: string | null;
  correlationId?: string | null;
  remarks?: string | null;
}

export function buildAuditRow(input: AuditEntryInput): Record<string, unknown> {
  return {
    organization_id: input.organizationId,
    branch_id: input.branchId ?? null,
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? null,
    actor_kind: input.actorKind ?? "other",
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before: input.before ?? null,
    after: {
      ...(input.after ?? {}),
      ...(input.remarks ? { remarks: input.remarks } : {}),
    },
    ip_address: input.ipAddress ?? null,
    device_id: input.deviceId ?? null,
    correlation_id: input.correlationId ?? null,
  };
}

export function auditActionForKind(kind: AuditActorKind, entityType: string): string {
  switch (kind) {
    case "creator":
      return `${entityType}.create`;
    case "editor":
      return `${entityType}.update`;
    case "deleter":
      return `${entityType}.delete`;
    case "approver":
      return `${entityType}.approve`;
    case "canceller":
      return `${entityType}.cancel`;
    case "discount_giver":
      return `${entityType}.discount`;
    case "payment_receiver":
      return `${entityType}.payment_receive`;
    case "stock_adjuster":
      return `${entityType}.stock_adjust`;
    default:
      return `${entityType}.change`;
  }
}
