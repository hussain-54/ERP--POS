import type {
  CreateCreditApprovalInput,
  CreateCustomerInput,
  CreateInstallmentPlanInput,
  CreatePaymentMethodInput,
  CreateSupplierInput,
  Customer,
  PartyLedgerEntry,
  Payment,
  PostSplitPaymentInput,
  Supplier,
} from "@electronic-erp/contracts";
import {
  applyCustomerLedgerEffect,
  applySupplierLedgerEffect,
  assertCreditAllowed,
  assertSplitMatchesBill,
  buildInstallmentPlan,
  creditPortion,
  evaluateCredit,
  ValidationDomainError,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

const SYSTEM_METHODS: Array<{ code: string; name: string; kind: string; sort: number }> = [
  { code: "CASH", name: "Cash", kind: "cash", sort: 1 },
  { code: "BANK", name: "Bank", kind: "bank", sort: 2 },
  { code: "CARD", name: "Card", kind: "card", sort: 3 },
  { code: "JAZZCASH", name: "JazzCash", kind: "jazzcash", sort: 4 },
  { code: "EASYPAISA", name: "Easypaisa", kind: "easypaisa", sort: 5 },
  { code: "SADAPAY", name: "SadaPay", kind: "sadapay", sort: 6 },
  { code: "ONLINE", name: "Online payment", kind: "online", sort: 7 },
  { code: "CREDIT", name: "Credit", kind: "credit", sort: 8 },
  { code: "INSTALLMENT", name: "Installment", kind: "installment", sort: 9 },
];

export class PartiesRepository {
  constructor(private readonly db: DatabaseClient) {}

  // --- customers ---
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const { data, error } = await this.db
      .from("customers")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        name_ur: input.nameUr ?? null,
        mobile: input.mobile ?? null,
        alternate_mobile: input.alternateMobile ?? null,
        address: input.address ?? null,
        cnic: input.cnic ?? null,
        reference_name: input.referenceName ?? null,
        customer_type: input.customerType ?? "retail",
        credit_limit: input.creditLimit ?? "0",
        credit_days: input.creditDays ?? 0,
        is_active: input.isActive ?? true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapCustomer(data);
  }

  async listCustomers(organizationId: string, q?: string) {
    let query = this.db
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (q) query = query.or(`name.ilike.%${q}%,mobile.ilike.%${q}%,code.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapCustomer);
  }

  async getCustomer(id: string) {
    const { data, error } = await this.db.from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapCustomer(data) : null;
  }

  async updateCustomer(id: string, patch: Record<string, unknown>) {
    const mapped: Row = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(patch)) mapped[camelToSnake(k)] = v;
    const { data, error } = await this.db.from("customers").update(mapped).eq("id", id).select("*").single();
    if (error) throw error;
    return mapCustomer(data);
  }

  // --- suppliers ---
  async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
    const { data, error } = await this.db
      .from("suppliers")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        company_name: input.companyName,
        contact_person: input.contactPerson ?? null,
        mobile: input.mobile ?? null,
        address: input.address ?? null,
        ntn: input.ntn ?? null,
        strn: input.strn ?? null,
        bank_name: input.bankName ?? null,
        bank_account_title: input.bankAccountTitle ?? null,
        bank_account_number: input.bankAccountNumber ?? null,
        bank_iban: input.bankIban ?? null,
        is_active: input.isActive ?? true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapSupplier(data);
  }

  async listSuppliers(organizationId: string) {
    const { data, error } = await this.db
      .from("suppliers")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("company_name");
    if (error) throw error;
    return (data ?? []).map(mapSupplier);
  }

  async getSupplier(id: string) {
    const { data, error } = await this.db.from("suppliers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapSupplier(data) : null;
  }

  // --- payment methods ---
  async ensureSystemPaymentMethods(organizationId: string) {
    for (const m of SYSTEM_METHODS) {
      await this.db.from("payment_methods").upsert(
        {
          organization_id: organizationId,
          code: m.code,
          name: m.name,
          kind: m.kind,
          is_system: true,
          is_active: true,
          sort_order: m.sort,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,code" },
      );
    }
    return this.listPaymentMethods(organizationId);
  }

  async listPaymentMethods(organizationId: string) {
    const { data, error } = await this.db
      .from("payment_methods")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  }

  async createPaymentMethod(input: CreatePaymentMethodInput) {
    const { data, error } = await this.db
      .from("payment_methods")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        kind: input.kind,
        is_system: false,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 100,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  // --- ledger ---
  async listLedger(params: {
    organizationId: string;
    customerId?: string;
    supplierId?: string;
  }): Promise<PartyLedgerEntry[]> {
    let q = this.db
      .from("party_ledger_entries")
      .select("*")
      .eq("organization_id", params.organizationId)
      .order("occurred_at", { ascending: true });
    if (params.customerId) q = q.eq("customer_id", params.customerId);
    if (params.supplierId) q = q.eq("supplier_id", params.supplierId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapLedger);
  }

  async postCustomerLedger(input: {
    organizationId: string;
    branchId?: string;
    customerId: string;
    entryType: PartyLedgerEntry["entryType"];
    amount: string;
    sourceType: string;
    sourceId: string;
    description?: string;
    userId?: string | null;
    operationId?: string;
  }): Promise<PartyLedgerEntry> {
    const customer = await this.getCustomer(input.customerId);
    if (!customer) throw new ValidationDomainError("Customer not found");
    const effect = applyCustomerLedgerEffect(customer.outstanding, input.entryType, input.amount);
    const { data, error } = await this.db
      .from("party_ledger_entries")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        party_type: "customer",
        customer_id: input.customerId,
        entry_type: input.entryType,
        debit: effect.debit,
        credit: effect.credit,
        balance_after: effect.balanceAfter,
        source_type: input.sourceType,
        source_id: input.sourceId,
        description: input.description ?? null,
        created_by: input.userId ?? null,
        operation_id: input.operationId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const totals = { ...customer };
    if (input.entryType === "sale") {
      totals.totalPurchases = String(Number(customer.totalPurchases) + Number(input.amount));
    }
    if (input.entryType === "payment") {
      totals.totalPaid = String(Number(customer.totalPaid) + Number(input.amount));
    }
    await this.db
      .from("customers")
      .update({
        outstanding: effect.balanceAfter,
        total_purchases: totals.totalPurchases,
        total_paid: totals.totalPaid,
        updated_at: new Date().toISOString(),
        version: customer.version + 1,
      })
      .eq("id", input.customerId)
      .eq("version", customer.version);

    return mapLedger(data);
  }

  async postSupplierLedger(input: {
    organizationId: string;
    branchId?: string;
    supplierId: string;
    entryType: PartyLedgerEntry["entryType"];
    amount: string;
    sourceType: string;
    sourceId: string;
    description?: string;
    userId?: string | null;
    operationId?: string;
  }): Promise<PartyLedgerEntry> {
    const supplier = await this.getSupplier(input.supplierId);
    if (!supplier) throw new ValidationDomainError("Supplier not found");
    const effect = applySupplierLedgerEffect(supplier.payableBalance, input.entryType, input.amount);
    const { data, error } = await this.db
      .from("party_ledger_entries")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        party_type: "supplier",
        supplier_id: input.supplierId,
        entry_type: input.entryType,
        debit: effect.debit,
        credit: effect.credit,
        balance_after: effect.balanceAfter,
        source_type: input.sourceType,
        source_id: input.sourceId,
        description: input.description ?? null,
        created_by: input.userId ?? null,
        operation_id: input.operationId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.db
      .from("suppliers")
      .update({
        payable_balance: effect.balanceAfter,
        updated_at: new Date().toISOString(),
        version: supplier.version + 1,
      })
      .eq("id", input.supplierId)
      .eq("version", supplier.version);

    return mapLedger(data);
  }

  // --- payments ---
  async postSplitPayment(input: PostSplitPaymentInput, userId?: string | null): Promise<Payment> {
    const { data: existing } = await this.db
      .from("payments")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return mapPayment(existing);

    const methods = await this.listPaymentMethods(input.organizationId);
    const kindById = new Map(methods.map((m) => [String(m.id), String(m.kind) as never]));
    const total = assertSplitMatchesBill(
      input.splits.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: s.amount,
        kind: kindById.get(s.paymentMethodId),
      })),
      input.billTotal,
    );

    const creditAmt = creditPortion(
      input.splits.map((s) => ({
        paymentMethodId: s.paymentMethodId,
        amount: s.amount,
        kind: kindById.get(s.paymentMethodId),
      })),
      kindById,
    );

    if (input.partyType === "customer" && input.customerId && Number(creditAmt) > 0) {
      const customer = await this.getCustomer(input.customerId);
      if (!customer) throw new ValidationDomainError("Customer not found");
      const check = evaluateCredit({
        creditLimit: customer.creditLimit,
        outstanding: customer.outstanding,
        additionalCredit: creditAmt,
        creditDays: customer.creditDays,
        isBlocked: customer.isBlocked,
      });
      assertCreditAllowed(check, Boolean(input.creditApprovalId));
      if (input.creditApprovalId) {
        const { data: approval } = await this.db
          .from("credit_approvals")
          .select("*")
          .eq("id", input.creditApprovalId)
          .eq("status", "approved")
          .maybeSingle();
        if (!approval) throw new ValidationDomainError("Valid credit approval required");
      }
    }

    const receiptNumber = `RCV-${Date.now()}`;
    const { data: payment, error } = await this.db
      .from("payments")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        direction: input.direction,
        party_type: input.partyType,
        customer_id: input.customerId ?? null,
        supplier_id: input.supplierId ?? null,
        total_amount: total,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        receipt_number: receiptNumber,
        status: "posted",
        source_type: input.sourceType ?? null,
        source_id: input.sourceId ?? null,
        idempotency_key: input.idempotencyKey,
        device_id: input.deviceId ?? null,
        offline_transaction_id: input.offlineTransactionId ?? null,
        operation_id: input.operationId ?? input.idempotencyKey,
        sync_state: input.offlineTransactionId ? "pending" : "synced",
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    for (const split of input.splits) {
      const { error: splitErr } = await this.db.from("payment_splits").insert({
        organization_id: input.organizationId,
        payment_id: payment.id,
        payment_method_id: split.paymentMethodId,
        amount: split.amount,
        reference: split.reference ?? null,
      });
      if (splitErr) throw splitErr;
    }

    await this.db.from("payment_receipts").insert({
      organization_id: input.organizationId,
      payment_id: payment.id,
      receipt_number: receiptNumber,
    });

    // Cash/bank/card portions reduce receivable; credit portion leaves outstanding (already on books via sale)
    // For receive against bill: non-credit splits = payment ledger entries
    const nonCredit = input.splits.filter((s) => {
      const kind = kindById.get(s.paymentMethodId);
      return kind !== "credit" && kind !== "installment";
    });
    const paidNow = nonCredit.reduce((a, s) => a + Number(s.amount), 0);

    if (input.partyType === "customer" && input.customerId && paidNow > 0) {
      await this.postCustomerLedger({
        organizationId: input.organizationId,
        branchId: input.branchId,
        customerId: input.customerId,
        entryType: "payment",
        amount: String(paidNow),
        sourceType: "payment",
        sourceId: String(payment.id),
        description: `Payment ${receiptNumber}`,
        userId,
        operationId: String(payment.operation_id ?? payment.idempotency_key),
      });
    }

    if (input.partyType === "supplier" && input.supplierId) {
      await this.postSupplierLedger({
        organizationId: input.organizationId,
        branchId: input.branchId,
        supplierId: input.supplierId,
        entryType: "payment",
        amount: total,
        sourceType: "payment",
        sourceId: String(payment.id),
        description: `Supplier payment ${receiptNumber}`,
        userId,
        operationId: String(payment.operation_id ?? payment.idempotency_key),
      });
    }

    return mapPayment(payment);
  }

  // --- credit ---
  async requestCreditApproval(input: CreateCreditApprovalInput, userId?: string | null) {
    const customer = await this.getCustomer(input.customerId);
    if (!customer) throw new ValidationDomainError("Customer not found");
    const { data, error } = await this.db
      .from("credit_approvals")
      .insert({
        organization_id: input.organizationId,
        customer_id: input.customerId,
        requested_amount: input.requestedAmount,
        credit_limit: customer.creditLimit,
        outstanding_before: customer.outstanding,
        reason: input.reason ?? null,
        status: "pending",
        requested_by: userId ?? null,
        source_type: input.sourceType ?? null,
        source_id: input.sourceId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async decideCreditApproval(id: string, approve: boolean, userId?: string | null) {
    const { data, error } = await this.db
      .from("credit_approvals")
      .update({
        status: approve ? "approved" : "rejected",
        approved_by: userId ?? null,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async setCustomerBlocked(customerId: string, blocked: boolean) {
    const { data, error } = await this.db
      .from("customers")
      .update({ is_blocked: blocked, updated_at: new Date().toISOString() })
      .eq("id", customerId)
      .select("*")
      .single();
    if (error) throw error;
    return mapCustomer(data);
  }

  async createOverdueReminders(organizationId: string, asOfDate: string) {
    const customers = await this.listCustomers(organizationId);
    const created = [];
    for (const c of customers) {
      if (Number(c.outstanding) <= 0) continue;
      // due = today - credit_days already passed when outstanding remains
      const due = new Date(`${asOfDate}T00:00:00.000Z`);
      due.setUTCDate(due.getUTCDate() - c.creditDays);
      const dueDate = due.toISOString().slice(0, 10);
      if (c.creditDays > 0 && Number(c.outstanding) > 0) {
        const { data, error } = await this.db
          .from("credit_reminders")
          .insert({
            organization_id: organizationId,
            customer_id: c.id,
            due_date: dueDate,
            outstanding: c.outstanding,
            reminder_type: "overdue",
            status: "pending",
            message: `Overdue balance ${c.outstanding} for ${c.name}`,
          })
          .select("*")
          .single();
        if (!error && data) created.push(data);
      }
    }
    return created;
  }

  // --- installments ---
  async createInstallmentPlan(input: CreateInstallmentPlanInput, userId?: string | null) {
    const built = buildInstallmentPlan({
      totalAmount: input.totalAmount,
      downPayment: input.downPayment ?? "0",
      installmentCount: input.installmentCount,
      startDate: input.startDate,
    });

    const { data: plan, error } = await this.db
      .from("installment_plans")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        customer_id: input.customerId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        total_amount: input.totalAmount,
        down_payment: input.downPayment ?? "0",
        remaining_amount: built.remainingAmount,
        installment_count: input.installmentCount,
        monthly_amount: built.monthlyAmount,
        start_date: input.startDate,
        status: "active",
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    for (const item of built.schedule) {
      const { error: lineErr } = await this.db.from("installment_schedule").insert({
        organization_id: input.organizationId,
        plan_id: plan.id,
        sequence_no: item.sequenceNo,
        due_date: item.dueDate,
        amount: item.amount,
        status: "pending",
      });
      if (lineErr) throw lineErr;
    }

    const schedule = await this.listInstallmentSchedule(String(plan.id));
    return { plan, schedule };
  }

  async listInstallmentSchedule(planId: string) {
    const { data, error } = await this.db
      .from("installment_schedule")
      .select("*")
      .eq("plan_id", planId)
      .order("sequence_no");
    if (error) throw error;
    return data ?? [];
  }

  async listInstallmentPlans(customerId: string) {
    const { data, error } = await this.db
      .from("installment_plans")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listPayments(organizationId: string, customerId?: string, supplierId?: string) {
    let q = this.db
      .from("payments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false });
    if (customerId) q = q.eq("customer_id", customerId);
    if (supplierId) q = q.eq("supplier_id", supplierId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapPayment);
  }
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function mapCustomer(row: Row): Customer {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    code: String(row.code),
    name: String(row.name),
    nameUr: (row.name_ur as string | null) ?? null,
    mobile: (row.mobile as string | null) ?? null,
    alternateMobile: (row.alternate_mobile as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    cnic: (row.cnic as string | null) ?? null,
    referenceName: (row.reference_name as string | null) ?? null,
    customerType: row.customer_type as Customer["customerType"],
    creditLimit: String(row.credit_limit ?? "0"),
    creditDays: Number(row.credit_days ?? 0),
    totalPurchases: String(row.total_purchases ?? "0"),
    totalPaid: String(row.total_paid ?? "0"),
    outstanding: String(row.outstanding ?? "0"),
    isBlocked: Boolean(row.is_blocked),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    version: Number(row.version ?? 1),
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

function mapSupplier(row: Row): Supplier {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    code: String(row.code),
    companyName: String(row.company_name),
    contactPerson: (row.contact_person as string | null) ?? null,
    mobile: (row.mobile as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    ntn: (row.ntn as string | null) ?? null,
    strn: (row.strn as string | null) ?? null,
    bankName: (row.bank_name as string | null) ?? null,
    bankAccountTitle: (row.bank_account_title as string | null) ?? null,
    bankAccountNumber: (row.bank_account_number as string | null) ?? null,
    bankIban: (row.bank_iban as string | null) ?? null,
    payableBalance: String(row.payable_balance ?? "0"),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    version: Number(row.version ?? 1),
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

function mapLedger(row: Row): PartyLedgerEntry {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    branchId: (row.branch_id as string | null) ?? null,
    partyType: row.party_type as PartyLedgerEntry["partyType"],
    customerId: (row.customer_id as string | null) ?? null,
    supplierId: (row.supplier_id as string | null) ?? null,
    entryType: row.entry_type as PartyLedgerEntry["entryType"],
    debit: String(row.debit ?? "0"),
    credit: String(row.credit ?? "0"),
    balanceAfter: String(row.balance_after ?? "0"),
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    description: (row.description as string | null) ?? null,
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at),
    createdBy: (row.created_by as string | null) ?? null,
    operationId: (row.operation_id as string | null) ?? null,
  };
}

function mapPayment(row: Row): Payment {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    branchId: String(row.branch_id),
    direction: row.direction as Payment["direction"],
    partyType: row.party_type as Payment["partyType"],
    customerId: (row.customer_id as string | null) ?? null,
    supplierId: (row.supplier_id as string | null) ?? null,
    totalAmount: String(row.total_amount),
    reference: (row.reference as string | null) ?? null,
    receiptNumber: (row.receipt_number as string | null) ?? null,
    status: row.status as Payment["status"],
    idempotencyKey: String(row.idempotency_key),
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at),
    syncState: (row.sync_state as Payment["syncState"]) ?? "synced",
  };
}
