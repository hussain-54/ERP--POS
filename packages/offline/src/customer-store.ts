import type { Customer, CreateCustomerInput, UpdateCustomerInput } from "@electronic-erp/contracts";
import { toCustomerSearchHit } from "@electronic-erp/domain";
import type { SyncEngine } from "@electronic-erp/sync";
import { enqueueCustomerUpsert } from "@electronic-erp/sync";

/**
 * Offline customer store — same entity shape as Supabase `customers`.
 * Used when offline (SQLite-backed desktop runtime or in-memory tests).
 * Does not invent a second customer identity model.
 */
export class OfflineCustomerStore {
  private readonly customers = new Map<string, Customer>();
  private readonly pendingSync = new Map<string, Customer>();

  upsertFromSync(customer: Customer): void {
    this.customers.set(customer.id, { ...customer });
  }

  get(id: string): Customer | null {
    const row = this.customers.get(id);
    if (!row || row.deletedAt) return null;
    return { ...row };
  }

  list(organizationId: string): Customer[] {
    return [...this.customers.values()]
      .filter((c) => c.organizationId === organizationId && !c.deletedAt && c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  search(organizationId: string, q?: string, limit = 12) {
    const needle = (q ?? "").trim().toLowerCase();
    const rows = this.list(organizationId).filter((c) => {
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.mobile ?? "").toLowerCase().includes(needle) ||
        c.code.toLowerCase().includes(needle) ||
        (c.email ?? "").toLowerCase().includes(needle)
      );
    });
    return rows.slice(0, limit).map(toCustomerSearchHit);
  }

  create(input: CreateCustomerInput & { id: string; now?: string }): Customer {
    const now = input.now ?? new Date().toISOString();
    const email = input.email?.trim() ? input.email.trim() : null;
    const customer: Customer = {
      id: input.id,
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      nameUr: input.nameUr ?? null,
      mobile: input.mobile ?? null,
      alternateMobile: input.alternateMobile ?? null,
      email,
      address: input.address ?? null,
      cnic: input.cnic ?? null,
      referenceName: input.referenceName ?? null,
      customerType: input.customerType ?? "retail",
      creditLimit: String(input.creditLimit ?? "0"),
      creditDays: input.creditDays ?? 0,
      totalPurchases: "0",
      totalPaid: "0",
      outstanding: "0",
      isBlocked: false,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      deletedAt: null,
    };
    this.customers.set(customer.id, customer);
    this.pendingSync.set(customer.id, customer);
    return { ...customer };
  }

  update(id: string, patch: UpdateCustomerInput): Customer {
    const existing = this.get(id);
    if (!existing) throw new Error("Customer not found");
    const email =
      patch.email === undefined
        ? existing.email
        : patch.email === "" || patch.email == null
          ? null
          : patch.email;
    const next: Customer = {
      ...existing,
      ...patch,
      email: email ?? null,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    this.customers.set(id, next);
    this.pendingSync.set(id, next);
    return { ...next };
  }

  listPendingSync(): Customer[] {
    return [...this.pendingSync.values()];
  }

  markSynced(id: string): void {
    this.pendingSync.delete(id);
  }

  async flush(engine: SyncEngine, deviceId: string): Promise<number> {
    let accepted = 0;
    for (const customer of this.listPendingSync()) {
      const result = await enqueueCustomerUpsert(
        engine,
        deviceId,
        customer,
        `${customer.id}:${customer.version}`,
      );
      if (!result.deferred && result.accepted > 0) {
        this.markSynced(customer.id);
        accepted += 1;
      }
    }
    return accepted;
  }
}
