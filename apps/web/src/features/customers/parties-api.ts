/** Shared client: 12 Customers, 13 Suppliers, 22 Installments, 05 Sales payments. Do not split into 39 clients. */
import type { Customer, PartyLedgerEntry, Payment, Supplier } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const partiesApi = {
  listCustomers(q?: string) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return apiFetch<{ items: Customer[] }>(`/api/v1/parties/customers${qs}`, { token: token() });
  },
  createCustomer(body: Record<string, unknown>) {
    return apiFetch<Customer>("/api/v1/parties/customers", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  getCustomer(id: string) {
    return apiFetch<Customer>(`/api/v1/parties/customers/${id}`, { token: token() });
  },
  updateCustomer(id: string, body: Record<string, unknown>) {
    return apiFetch<Customer>(`/api/v1/parties/customers/${id}`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  blockCustomer(id: string) {
    return apiFetch(`/api/v1/parties/customers/${id}/block`, { method: "POST", token: token() });
  },
  unblockCustomer(id: string) {
    return apiFetch(`/api/v1/parties/customers/${id}/unblock`, { method: "POST", token: token() });
  },
  customerLedger(id: string) {
    return apiFetch<{ items: PartyLedgerEntry[] }>(`/api/v1/parties/customers/${id}/ledger`, {
      token: token(),
    });
  },
  customerPayments(id: string) {
    return apiFetch<{ items: Payment[] }>(`/api/v1/parties/customers/${id}/payments`, { token: token() });
  },
  postCustomerLedger(id: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/parties/customers/${id}/ledger`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listSuppliers() {
    return apiFetch<{ items: Supplier[] }>("/api/v1/parties/suppliers", { token: token() });
  },
  createSupplier(body: Record<string, unknown>) {
    return apiFetch<Supplier>("/api/v1/parties/suppliers", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  supplierLedger(id: string) {
    return apiFetch<{ items: PartyLedgerEntry[] }>(`/api/v1/parties/suppliers/${id}/ledger`, {
      token: token(),
    });
  },
  seedPaymentMethods() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/parties/payment-methods/seed", {
      method: "POST",
      token: token(),
    });
  },
  listPaymentMethods() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/parties/payment-methods", {
      token: token(),
    });
  },
  postPayment(body: Record<string, unknown>) {
    return apiFetch<Payment>("/api/v1/parties/payments", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  requestCreditApproval(body: Record<string, unknown>) {
    return apiFetch("/api/v1/parties/credit/approvals", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  approveCredit(id: string) {
    return apiFetch(`/api/v1/parties/credit/approvals/${id}/approve`, {
      method: "POST",
      token: token(),
    });
  },
  generateReminders(asOfDate?: string) {
    return apiFetch("/api/v1/parties/credit/reminders/generate", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ asOfDate }),
    });
  },
  createInstallmentPlan(body: Record<string, unknown>) {
    return apiFetch("/api/v1/parties/installments", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  installmentSchedule(planId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/parties/installments/${planId}/schedule`,
      { token: token() },
    );
  },
};
