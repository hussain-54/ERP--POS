/**
 * POS customer repository — online API only (partiesApi → API → Supabase).
 */
import type { Customer, CustomerSearchHit, UpdateCustomerInput } from "@electronic-erp/contracts";
import { toCustomerSearchHit } from "@electronic-erp/domain";
import { partiesApi } from "@/features/parties/parties-api";
import { commerceApi } from "@/features/commerce/commerce-api";
import { toPosCustomerProfile } from "./pos-customer-runtime";

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
    organizationId: string;
    canRead: boolean;
  }): Promise<CustomerSearchHit[]> {
    void input.organizationId;
    if (!input.canRead) return [];
    const res = await partiesApi.listCustomers(input.q);
    return res.items.slice(0, 12).map(toCustomerSearchHit);
  },

  async get(input: {
    id: string;
    organizationId: string;
    canRead: boolean;
    canViewLoyalty: boolean;
  }) {
    void input.organizationId;
    if (!input.canRead) throw new Error("Missing customers.read permission");
    const customer: Customer = await partiesApi.getCustomer(input.id);

    let loyaltyPoints: number | null = null;
    if (input.canViewLoyalty) {
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
    organizationId: string;
    canWrite: boolean;
    body: PosCustomerCreateInput;
  }) {
    void input.organizationId;
    if (!input.canWrite) throw new Error("Missing customers.write permission");
    return partiesApi.createCustomer({
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
  },

  async update(input: {
    id: string;
    organizationId: string;
    canWrite: boolean;
    patch: UpdateCustomerInput;
  }) {
    void input.organizationId;
    if (!input.canWrite) throw new Error("Missing customers.write permission");
    return partiesApi.updateCustomer(input.id, input.patch);
  },

  async history(input: {
    id: string;
    canRead: boolean;
  }): Promise<
    Array<{ id: string; entryType: string; amount: string; occurredAt: string; description?: string | null }>
  > {
    if (!input.canRead) return [];
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
