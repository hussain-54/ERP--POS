import type { Customer, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncEngine } from "./engine.js";

export const CUSTOMER_SYNC_ENTITY = "customers";

/** Queue a customer upsert through the sync abstraction (same entity as Supabase). */
export function enqueueCustomerUpsert(
  engine: SyncEngine,
  deviceId: string,
  customer: Customer,
  idempotencyKey: string,
): Promise<{ accepted: number; conflicts: number; deferred: boolean }> {
  const request: SyncPushRequest = {
    deviceId,
    items: [
      {
        entityType: CUSTOMER_SYNC_ENTITY,
        entityId: customer.id,
        idempotencyKey,
        payload: customer as unknown as Record<string, unknown>,
      },
    ],
  };
  return engine.push(request);
}

export function applyCustomerRowToOfflineShape(customer: Customer): Record<string, unknown> {
  return {
    id: customer.id,
    organization_id: customer.organizationId,
    code: customer.code,
    name: customer.name,
    name_ur: customer.nameUr ?? null,
    mobile: customer.mobile ?? null,
    alternate_mobile: customer.alternateMobile ?? null,
    email: customer.email ?? null,
    address: customer.address ?? null,
    cnic: customer.cnic ?? null,
    reference_name: customer.referenceName ?? null,
    customer_type: customer.customerType,
    credit_limit: String(customer.creditLimit),
    credit_days: customer.creditDays,
    total_purchases: String(customer.totalPurchases),
    total_paid: String(customer.totalPaid),
    outstanding: String(customer.outstanding),
    is_blocked: customer.isBlocked ? 1 : 0,
    is_active: customer.isActive ? 1 : 0,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
    version: customer.version,
    deleted_at: customer.deletedAt ?? null,
  };
}
