/**
 * POS customer repository — online → Supabase via partiesApi;
 * offline → local cache mirroring the same Customer entity (SQLite on desktop via offline package).
 */
import type { Customer, CreateCustomerInput, CustomerSearchHit, UpdateCustomerInput } from "@electronic-erp/contracts";
import { toCustomerSearchHit } from "@electronic-erp/domain";
import { partiesApi } from "@/features/parties/parties-api";
import { commerceApi } from "@/features/commerce/commerce-api";
import { PosCustomerOfflineCache, toPosCustomerProfile } from "./pos-customer-runtime";

const CACHE_KEY = "erp-pos-customer-cache-v1";

let offlineStore: PosCustomerOfflineCache | null = null;

function getOfflineStore(): PosCustomerOfflineCache {
  if (!offlineStore) {
    offlineStore = new PosCustomerOfflineCache();
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Customer[];
        if (Array.isArray(parsed)) {
          for (const c of parsed) offlineStore.upsertFromSync(c);
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
  }
  return offlineStore;
}

function persistOfflineCache(organizationId: string) {
  try {
    const rows = getOfflineStore().list(organizationId);
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows.slice(0, 500)));
  } catch {
    /* quota */
  }
}

export type PosCustomerCreateInput = {
  code: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  cnic?: string;
  customerType?: "retail" | "wholesale" | "dealer";
  creditLimit?: string;
};

export const posCustomerRepository = {
  async search(input: {
    q: string;
    online: boolean;
    organizationId: string;
    canRead: boolean;
  }): Promise<CustomerSearchHit[]> {
    if (!input.canRead) return [];
    if (input.online) {
      const res = await partiesApi.listCustomers(input.q);
      for (const c of res.items) getOfflineStore().upsertFromSync(c);
      persistOfflineCache(input.organizationId);
      return res.items.slice(0, 12).map(toCustomerSearchHit);
    }
    return getOfflineStore().search(input.organizationId, input.q, 12);
  },

  async get(input: {
    id: string;
    online: boolean;
    organizationId: string;
    canRead: boolean;
    canViewLoyalty: boolean;
  }) {
    if (!input.canRead) throw new Error("Missing customers.read permission");
    let customer: Customer | null = null;
    if (input.online) {
      customer = await partiesApi.getCustomer(input.id);
      getOfflineStore().upsertFromSync(customer);
      persistOfflineCache(input.organizationId);
    } else {
      customer = getOfflineStore().get(input.id);
    }
    if (!customer) throw new Error("Customer not found");

    let loyaltyPoints: number | null = null;
    if (input.online && input.canViewLoyalty) {
      try {
        const acc = await commerceApi.account(input.id);
        const bal = (acc.item as { points_balance?: number | string } | undefined)?.points_balance;
        loyaltyPoints = bal != null ? Number(bal) : 0;
        if (!Number.isFinite(loyaltyPoints)) loyaltyPoints = 0;
      } catch {
        loyaltyPoints = null;
      }
    }
    return toPosCustomerProfile(customer, { loyaltyPoints });
  },

  async create(input: {
    online: boolean;
    organizationId: string;
    canWrite: boolean;
    body: PosCustomerCreateInput;
  }) {
    if (!input.canWrite) throw new Error("Missing customers.write permission");
    if (input.online) {
      const created = await partiesApi.createCustomer({
        code: input.body.code,
        name: input.body.name,
        mobile: input.body.mobile ?? "",
        email: input.body.email ?? "",
        address: input.body.address ?? "",
        cnic: input.body.cnic ?? "",
        customerType: input.body.customerType ?? "retail",
        creditLimit: input.body.creditLimit ?? "0",
        creditDays: 0,
      });
      getOfflineStore().upsertFromSync(created);
      persistOfflineCache(input.organizationId);
      return created;
    }
    const created = getOfflineStore().create({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      code: input.body.code,
      name: input.body.name,
      mobile: input.body.mobile,
      email: input.body.email,
      address: input.body.address,
      cnic: input.body.cnic,
      customerType: input.body.customerType ?? "retail",
      creditLimit: input.body.creditLimit ?? "0",
      creditDays: 0,
    } as CreateCustomerInput & { id: string });
    persistOfflineCache(input.organizationId);
    return created;
  },

  async update(input: {
    id: string;
    online: boolean;
    organizationId: string;
    canWrite: boolean;
    patch: UpdateCustomerInput;
  }) {
    if (!input.canWrite) throw new Error("Missing customers.write permission");
    if (input.online) {
      const updated = await partiesApi.updateCustomer(input.id, input.patch);
      getOfflineStore().upsertFromSync(updated);
      persistOfflineCache(input.organizationId);
      return updated;
    }
    const updated = getOfflineStore().update(input.id, input.patch);
    persistOfflineCache(input.organizationId);
    return updated;
  },

  async history(input: {
    id: string;
    online: boolean;
    canRead: boolean;
  }): Promise<
    Array<{ id: string; entryType: string; amount: string; occurredAt: string; description?: string | null }>
  > {
    if (!input.canRead || !input.online) return [];
    const res = await partiesApi.customerLedger(input.id);
    return res.items.slice(0, 20).map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: Number(e.debit) > 0 ? e.debit : e.credit,
      occurredAt: e.occurredAt,
      description: e.description ?? null,
    }));
  },
};
