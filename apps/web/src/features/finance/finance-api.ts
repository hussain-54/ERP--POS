import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

const base = "/api/v1/accounting";

export const financeApi = {
  seedCoa() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/coa/seed`, {
      method: "POST",
      token: token(),
    });
  },
  listAccounts() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/accounts`, {
      token: token(),
    });
  },
  createAccount(body: Record<string, unknown>) {
    return apiFetch(`${base}/accounts`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listJournals() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/journals`, {
      token: token(),
    });
  },
  createVoucher(body: Record<string, unknown>) {
    return apiFetch(`${base}/vouchers`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listVouchers(type?: string) {
    const qs = type ? `?type=${type}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/vouchers${qs}`, {
      token: token(),
    });
  },
  listBankAccounts() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/bank-accounts`, {
      token: token(),
    });
  },
  createBankAccount(body: Record<string, unknown>) {
    return apiFetch(`${base}/bank-accounts`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  importStatement(body: Record<string, unknown>) {
    return apiFetch(`${base}/bank-statements/import`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listStatementLines(bankAccountId: string, status?: string) {
    const qs = status ? `?status=${status}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `${base}/bank-statements/${bankAccountId}${qs}`,
      { token: token() },
    );
  },
  matchLine(body: Record<string, unknown>) {
    return apiFetch(`${base}/bank-statements/match`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  reconcile(body: Record<string, unknown>) {
    return apiFetch(`${base}/reconciliations`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listExpenses() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/expenses`, {
      token: token(),
    });
  },
  createExpense(body: Record<string, unknown>) {
    return apiFetch(`${base}/expenses`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  report(path: string, qs = "") {
    return apiFetch(`${base}/reports/${path}${qs}`, { token: token() });
  },
};
