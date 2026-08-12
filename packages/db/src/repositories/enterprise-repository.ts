import type {
  CreateDocumentInput,
  CreateEmployeeInput,
  CreateIncentiveSchema,
  CreateNotificationInput,
  CreateSalaryRunSchema,
  CreateSaleReferenceInput,
  CreateTaxDocumentSchema,
  CreateTaxRateInput,
  PayCommissionInput,
  UpdateEmployeeInput,
  UpdateSaleReferenceInput,
  UpsertAttendanceSchema,
  UpsertPerformanceSchema,
  UpsertTaxProfileSchema,
} from "@electronic-erp/contracts";
import {
  achievementPct,
  applyCommissionPayment,
  assertDocumentAccess,
  assertSalesmanActive,
  calculateNetSalary,
  calculateSalesCommission,
  documentStoragePath,
  NullNotificationChannelAdapter,
  performanceRating,
  splitTaxAmount,
  stockAlertNotifications,
  summarizeCommissionReports,
  voidCommissionForCancelledSale,
  ValidationDomainError,
  type CommissionRecord,
  type NotificationChannelAdapter,
} from "@electronic-erp/domain";
import type { z } from "zod";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;
type AttendanceInput = z.infer<typeof UpsertAttendanceSchema>;
type SalaryInput = z.infer<typeof CreateSalaryRunSchema>;
type IncentiveInput = z.infer<typeof CreateIncentiveSchema>;
type PerformanceInput = z.infer<typeof UpsertPerformanceSchema>;
type TaxProfileInput = z.infer<typeof UpsertTaxProfileSchema>;
type TaxDocInput = z.infer<typeof CreateTaxDocumentSchema>;

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}
function str(v: unknown): string {
  return String(v ?? "");
}

export class EnterpriseRepository {
  private channelAdapters: NotificationChannelAdapter[] = [
    new NullNotificationChannelAdapter("email"),
    new NullNotificationChannelAdapter("sms"),
    new NullNotificationChannelAdapter("push"),
  ];

  constructor(private readonly db: DatabaseClient) {}

  setChannelAdapters(adapters: NotificationChannelAdapter[]) {
    this.channelAdapters = adapters;
  }

  // ─── HR ───────────────────────────────────────────────
  async createEmployee(input: CreateEmployeeInput, userId: string | null) {
    const { data, error } = await this.db
      .from("employees")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        full_name: input.fullName,
        mobile: input.mobile ?? null,
        email: input.email ?? null,
        designation: input.designation ?? null,
        department: input.department ?? null,
        branch_id: input.branchId ?? null,
        user_id: input.userId ?? null,
        is_salesman: input.isSalesman ?? false,
        base_salary: Number(input.baseSalary ?? 0),
        commission_percent: input.commissionPercent ?? 0,
        join_date: input.joinDate ?? null,
        is_active: input.isActive ?? true,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listEmployees(organizationId: string) {
    const { data, error } = await this.db
      .from("employees")
      .select("*")
      .eq("organization_id", organizationId)
      .order("full_name")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  }

  async updateEmployee(input: UpdateEmployeeInput) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.code !== undefined) patch.code = input.code;
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.mobile !== undefined) patch.mobile = input.mobile ?? null;
    if (input.email !== undefined) patch.email = input.email ?? null;
    if (input.designation !== undefined) patch.designation = input.designation ?? null;
    if (input.department !== undefined) patch.department = input.department ?? null;
    if (input.branchId !== undefined) patch.branch_id = input.branchId ?? null;
    if (input.userId !== undefined) patch.user_id = input.userId ?? null;
    if (input.isSalesman !== undefined) patch.is_salesman = input.isSalesman;
    if (input.baseSalary !== undefined) patch.base_salary = Number(input.baseSalary ?? 0);
    if (input.commissionPercent !== undefined) patch.commission_percent = input.commissionPercent;
    if (input.joinDate !== undefined) patch.join_date = input.joinDate ?? null;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.db
      .from("employees")
      .update(patch)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Employee not found");
    return data;
  }

  async createSaleReference(input: CreateSaleReferenceInput, userId: string | null) {
    const { data, error } = await this.db
      .from("sale_references")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        mobile: input.mobile ?? null,
        reference_code: input.referenceCode,
        reference_type: input.referenceType ?? "outside",
        is_active: input.isActive ?? true,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateSaleReference(input: UpdateSaleReferenceInput) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.mobile !== undefined) patch.mobile = input.mobile ?? null;
    if (input.referenceCode !== undefined) patch.reference_code = input.referenceCode;
    if (input.referenceType !== undefined) patch.reference_type = input.referenceType;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.notes !== undefined) patch.notes = input.notes ?? null;
    const { data, error } = await this.db
      .from("sale_references")
      .update(patch)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Reference not found");
    return data;
  }

  async listSaleReferences(organizationId: string, activeOnly = false) {
    let q = this.db
      .from("sale_references")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name")
      .limit(500);
    if (activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async payCommission(input: PayCommissionInput) {
    const { data: row, error } = await this.db
      .from("sale_commissions")
      .select("*")
      .eq("id", input.commissionId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new ValidationDomainError("Commission not found");

    const current: CommissionRecord = {
      id: String(row.id),
      saleId: String(row.sale_id),
      salesmanUserId: String(row.salesman_user_id),
      employeeId: row.employee_id ? String(row.employee_id) : null,
      baseAmount: num(row.base_amount),
      commissionPercent: num(row.commission_percent),
      commissionAmount: num(row.commission_amount),
      status: row.status as CommissionRecord["status"],
      paidAmount: num(row.paid_amount),
      originalAmount: num(row.original_amount ?? row.commission_amount),
    };
    const next = applyCommissionPayment({
      commission: current,
      payAmount: Number(input.amount),
    });
    const nowIso = new Date().toISOString();
    const { data, error: updErr } = await this.db
      .from("sale_commissions")
      .update({
        paid_amount: next.paidAmount,
        status: next.status,
        paid_at: next.status === "paid" ? nowIso : row.paid_at,
        payment_reference: input.paymentReference ?? row.payment_reference,
        updated_at: nowIso,
      })
      .eq("id", input.commissionId)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return data;
  }

  /** Cancelled sale rule: void unpaid commission via shared domain helper. */
  async voidCommissionForSale(organizationId: string, saleId: string) {
    const { data: row, error } = await this.db
      .from("sale_commissions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("sale_id", saleId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    const current: CommissionRecord = {
      id: String(row.id),
      saleId: String(row.sale_id),
      salesmanUserId: String(row.salesman_user_id),
      employeeId: row.employee_id ? String(row.employee_id) : null,
      baseAmount: num(row.base_amount),
      commissionPercent: num(row.commission_percent),
      commissionAmount: num(row.commission_amount),
      status: row.status as CommissionRecord["status"],
      paidAmount: num(row.paid_amount),
      originalAmount: num(row.original_amount ?? row.commission_amount),
    };
    const next = voidCommissionForCancelledSale(current);
    const nowIso = new Date().toISOString();
    const { data, error: updErr } = await this.db
      .from("sale_commissions")
      .update({
        base_amount: next.baseAmount,
        commission_amount: next.commissionAmount,
        paid_amount: next.paidAmount,
        status: next.status,
        voided_at: next.status === "void" ? nowIso : row.voided_at,
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return data;
  }

  async commissionReports(organizationId: string) {
    const { data, error } = await this.db
      .from("sale_commissions")
      .select("*, sales(grand_total,reference_id,reference_name,status)")
      .eq("organization_id", organizationId)
      .limit(2000);
    if (error) throw error;
    const rows = (data ?? []).map((r) => {
      const sale = r.sales as {
        grand_total?: number;
        reference_id?: string | null;
        reference_name?: string | null;
        status?: string;
      } | null;
      return {
        salesmanUserId: str(r.salesman_user_id),
        referenceId: sale?.reference_id ?? null,
        referenceName: sale?.reference_name ?? null,
        saleGrandTotal: num(sale?.grand_total),
        commissionAmount: num(r.commission_amount),
        paidAmount: num(r.paid_amount),
        status: r.status as CommissionRecord["status"],
      };
    });
    return summarizeCommissionReports(rows);
  }

  async assertSalesmanEligible(organizationId: string, userId: string) {
    const { data } = await this.db
      .from("employees")
      .select("is_salesman,is_active,commission_percent")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) throw new ValidationDomainError("Salesman profile not found");
    assertSalesmanActive({
      isSalesman: Boolean(data.is_salesman),
      isActive: Boolean(data.is_active),
    });
    return data;
  }

  async upsertAttendance(input: AttendanceInput) {
    const { data, error } = await this.db
      .from("employee_attendance")
      .upsert(
        {
          organization_id: input.organizationId,
          employee_id: input.employeeId,
          work_date: input.workDate.slice(0, 10),
          status: input.status,
          check_in: input.checkIn ?? null,
          check_out: input.checkOut ?? null,
          notes: input.notes ?? null,
        },
        { onConflict: "employee_id,work_date" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listAttendance(organizationId: string, employeeId?: string) {
    let q = this.db
      .from("employee_attendance")
      .select("*")
      .eq("organization_id", organizationId)
      .order("work_date", { ascending: false })
      .limit(200);
    if (employeeId) q = q.eq("employee_id", employeeId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async createSalaryRun(input: SalaryInput, userId: string | null) {
    const totals = calculateNetSalary({
      baseSalary: Number(input.baseSalary),
      commissionAmount: Number(input.commissionAmount ?? 0),
      incentiveAmount: Number(input.incentiveAmount ?? 0),
      deductions: Number(input.deductions ?? 0),
    });
    const { data, error } = await this.db
      .from("salary_runs")
      .upsert(
        {
          organization_id: input.organizationId,
          employee_id: input.employeeId,
          period_ym: input.periodYm,
          base_salary: Number(input.baseSalary),
          commission_amount: Number(input.commissionAmount ?? 0),
          incentive_amount: Number(input.incentiveAmount ?? 0),
          deductions: Number(input.deductions ?? 0),
          gross_amount: totals.gross,
          net_amount: totals.net,
          status: "posted",
          notes: input.notes ?? null,
          created_by: userId,
        },
        { onConflict: "organization_id,employee_id,period_ym" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listSalaryRuns(organizationId: string) {
    const { data, error } = await this.db
      .from("salary_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("period_ym", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async createIncentive(input: IncentiveInput, userId: string | null) {
    const { data, error } = await this.db
      .from("employee_incentives")
      .insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        title: input.title,
        amount: Number(input.amount),
        period_ym: input.periodYm ?? null,
        reason: input.reason ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async upsertPerformance(input: PerformanceInput) {
    const ach = achievementPct(Number(input.salesAmount ?? 0), Number(input.targetAmount ?? 0));
    const rating = performanceRating(input.score);
    const { data, error } = await this.db
      .from("employee_performance")
      .upsert(
        {
          organization_id: input.organizationId,
          employee_id: input.employeeId,
          period_ym: input.periodYm,
          score: input.score,
          sales_amount: Number(input.salesAmount ?? 0),
          target_amount: Number(input.targetAmount ?? 0),
          achievement_pct: ach,
          rating,
          notes: input.notes ?? null,
        },
        { onConflict: "organization_id,employee_id,period_ym" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  /** Pull POS sale_commissions for a salesman user / employee and period. */
  async salesmanCommissionSummary(
    organizationId: string,
    opts: { employeeId?: string; userId?: string; periodYm?: string },
  ) {
    let employee: Row | null = null;
    if (opts.employeeId) {
      const { data } = await this.db
        .from("employees")
        .select("*")
        .eq("id", opts.employeeId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      employee = data;
    }
    const salesmanUserId = opts.userId ?? (employee?.user_id ? str(employee.user_id) : null);
    let q = this.db
      .from("sale_commissions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (salesmanUserId) q = q.eq("salesman_user_id", salesmanUserId);
    if (opts.employeeId) q = q.eq("employee_id", opts.employeeId);
    const { data, error } = await q;
    if (error) throw error;
    let rows = (data ?? []) as Row[];
    if (opts.periodYm) {
      rows = rows.filter((r) => str(r.created_at).startsWith(opts.periodYm!));
    }
    const active = rows.filter((r) => str(r.status) !== "void");
    const total = active.reduce((s, r) => s + num(r.commission_amount), 0);
    const paid = active.reduce((s, r) => s + num(r.paid_amount), 0);
    const due = Math.round((total - paid) * 100) / 100;
    const preview =
      employee && opts.periodYm
        ? calculateSalesCommission(
            active.reduce((s, r) => s + num(r.base_amount), 0),
            num(employee.commission_percent),
          )
        : null;
    return {
      employee,
      items: rows,
      totalCommission: Math.round(total * 100) / 100,
      totalPaid: Math.round(paid * 100) / 100,
      totalDue: due,
      recomputedFromEmployeeRate: preview,
    };
  }

  // ─── Tax ──────────────────────────────────────────────
  async upsertTaxProfile(input: TaxProfileInput) {
    const { data, error } = await this.db
      .from("tax_profiles")
      .upsert(
        {
          organization_id: input.organizationId,
          ntn: input.ntn ?? null,
          strn: input.strn ?? null,
          legal_name: input.legalName ?? null,
          tax_province: input.taxProvince ?? null,
          fbr_integration_enabled: false, // never claim live FBR unless implemented
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return {
      ...data,
      fbr_note:
        "Architecture-ready only. Live FBR integration is not enabled or claimed in this build.",
    };
  }

  async getTaxProfile(organizationId: string) {
    const { data } = await this.db
      .from("tax_profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    return (
      data ?? {
        organization_id: organizationId,
        ntn: null,
        strn: null,
        fbr_integration_enabled: false,
        fbr_note: "Architecture-ready only. Live FBR integration is not enabled.",
      }
    );
  }

  async createTaxRate(input: CreateTaxRateInput) {
    const { data, error } = await this.db
      .from("tax_rates")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        rate_percent: input.ratePercent,
        is_exempt: input.isExempt ?? false,
        is_default: input.isDefault ?? false,
        pricing_mode: input.pricingMode ?? "exclusive",
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listTaxRates(organizationId: string) {
    const { data, error } = await this.db
      .from("tax_rates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("code")
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async createTaxDocument(input: TaxDocInput, userId: string | null) {
    let taxable = Number(input.taxableAmount);
    let taxAmount = Number(input.taxAmount);
    let grand = Number(input.grandTotal);
    if (input.taxRateId) {
      const { data: rate } = await this.db
        .from("tax_rates")
        .select("*")
        .eq("id", input.taxRateId)
        .maybeSingle();
      if (rate) {
        const split = splitTaxAmount(
          Number(input.taxableAmount),
          num(rate.rate_percent),
          (input.pricingMode ?? rate.pricing_mode ?? "exclusive") as "inclusive" | "exclusive",
          Boolean(rate.is_exempt),
        );
        taxable = split.taxableAmount;
        taxAmount = split.taxAmount;
        grand = split.grandTotal;
      }
    }
    const documentNumber = `TAX-${Date.now()}`;
    const { data, error } = await this.db
      .from("tax_documents")
      .insert({
        organization_id: input.organizationId,
        document_number: documentNumber,
        document_type: input.documentType,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        tax_rate_id: input.taxRateId ?? null,
        taxable_amount: taxable,
        tax_amount: taxAmount,
        grand_total: grand,
        pricing_mode: input.pricingMode ?? "exclusive",
        buyer_ntn: input.buyerNtn ?? null,
        buyer_strn: input.buyerStrn ?? null,
        fbr_status: "not_integrated",
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listTaxDocuments(organizationId: string) {
    const { data, error } = await this.db
      .from("tax_documents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async taxReport(organizationId: string) {
    const docs = await this.listTaxDocuments(organizationId);
    const rates = await this.listTaxRates(organizationId);
    const taxable = docs.reduce((s, d: Row) => s + num(d.taxable_amount), 0);
    const tax = docs.reduce((s, d: Row) => s + num(d.tax_amount), 0);
    return {
      documentCount: docs.length,
      taxableTotal: Math.round(taxable * 100) / 100,
      taxTotal: Math.round(tax * 100) / 100,
      rates,
      fbrIntegration: false,
      note: "Tax report is local/architecture-ready. Live FBR submission is not implemented.",
      recent: docs.slice(0, 50),
    };
  }

  // ─── Documents ────────────────────────────────────────
  async createDocument(input: CreateDocumentInput, userId: string | null) {
    const storagePath =
      input.storagePath ||
      documentStoragePath({
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
      });
    const { data, error } = await this.db
      .from("managed_documents")
      .insert({
        organization_id: input.organizationId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        kind: input.kind,
        title: input.title,
        file_name: input.fileName,
        mime_type: input.mimeType ?? "application/octet-stream",
        byte_size: input.byteSize ?? 0,
        storage_path: storagePath,
        checksum_sha256: input.checksumSha256 ?? null,
        is_sensitive: input.isSensitive ?? false,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listDocuments(
    organizationId: string,
    opts: { entityType?: string; entityId?: string; canViewSensitive: boolean },
  ) {
    let q = this.db
      .from("managed_documents")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (opts.entityType) q = q.eq("entity_type", opts.entityType);
    if (opts.entityId) q = q.eq("entity_id", opts.entityId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).filter((d: Row) => {
      try {
        assertDocumentAccess({
          isSensitive: Boolean(d.is_sensitive),
          canViewSensitive: opts.canViewSensitive,
        });
        return true;
      } catch {
        return false;
      }
    });
  }

  // ─── Notifications ────────────────────────────────────
  async createNotification(input: CreateNotificationInput) {
    const channels = input.channels?.length ? input.channels : ["in_app"];
    const { data, error } = await this.db
      .from("app_notifications")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId ?? null,
        branch_id: input.branchId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        severity: input.severity ?? "info",
        channels,
        metadata_json: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (error) throw error;

    for (const ch of channels) {
      if (ch === "in_app") continue;
      const adapter = this.channelAdapters.find((a) => a.channel === ch);
      const result = adapter
        ? await adapter.send({
            toUserId: input.userId,
            title: input.title,
            body: input.body,
            metadata: input.metadata,
          })
        : { ok: false, detail: "no adapter" };
      await this.db.from("notification_channel_logs").insert({
        organization_id: input.organizationId,
        notification_id: data.id,
        channel: ch,
        status: result.ok ? "sent" : "skipped",
        detail: result.detail ?? null,
      });
    }
    return data;
  }

  async listNotifications(organizationId: string, userId: string | null) {
    let q = this.db
      .from("app_notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (userId) q = q.or(`user_id.is.null,user_id.eq.${userId}`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async markRead(organizationId: string, notificationId: string, userId: string | null) {
    const { data, error } = await this.db
      .from("app_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw error;
    return { item: data, userId };
  }

  async scanAndEnqueue(organizationId: string, opts: { warehouseId?: string; branchId?: string }) {
    const created: unknown[] = [];

    // Stock alerts
    let bq = this.db
      .from("stock_balances")
      .select("product_id,qty_on_hand")
      .eq("organization_id", organizationId)
      .limit(2000);
    if (opts.warehouseId) bq = bq.eq("warehouse_id", opts.warehouseId);
    const { data: balances } = await bq;
    const productIds = [...new Set((balances ?? []).map((b: Row) => str(b.product_id)))];
    const { data: products } = productIds.length
      ? await this.db
          .from("products")
          .select("id,name,reorder_level")
          .in("id", productIds.slice(0, 1000))
      : { data: [] };
    const nameMap = new Map((products ?? []).map((p: Row) => [str(p.id), p]));
    const stockMap = new Map<string, number>();
    for (const b of (balances ?? []) as Row[]) {
      const pid = str(b.product_id);
      stockMap.set(pid, (stockMap.get(pid) ?? 0) + num(b.qty_on_hand));
    }
    const facts = [...stockMap.entries()].map(([productId, qtyOnHand]) => {
      const p = nameMap.get(productId) as Row | undefined;
      const reorder = num(p?.reorder_level) || 5;
      return {
        productId,
        productName: str(p?.name ?? productId),
        qtyOnHand,
        reorderLevel: reorder,
        overstockLevel: reorder * 20,
      };
    });
    for (const n of stockAlertNotifications(facts).slice(0, 40)) {
      created.push(
        await this.createNotification({
          organizationId,
          branchId: opts.branchId,
          type: n.type,
          title: n.title,
          body: n.body,
          severity: n.severity,
          entityType: n.entityType,
          entityId: n.entityId,
          channels: ["in_app"],
          metadata: {},
        }),
      );
    }

    // Installments due (if table exists / has rows)
    const dueBefore = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: installments } = await this.db
      .from("installment_schedule")
      .select("id,due_date,amount,status")
      .eq("organization_id", organizationId)
      .lte("due_date", dueBefore)
      .limit(50);
    for (const row of (installments ?? []) as Row[]) {
      if (str(row.status) === "paid") continue;
      created.push(
        await this.createNotification({
          organizationId,
          type: "installment_due",
          title: "Installment due",
          body: `Installment ${str(row.id).slice(0, 8)} due ${str(row.due_date)} amount ${num(row.amount)}`,
          severity: "warning",
          entityType: "installment",
          entityId: str(row.id),
          channels: ["in_app"],
          metadata: {},
        }),
      );
    }

    const { data: onlineOrders } = await this.db
      .from("sales_orders")
      .select("id,order_number,channel,created_at")
      .eq("organization_id", organizationId)
      .eq("channel", "online")
      .order("created_at", { ascending: false })
      .limit(20);
    for (const o of (onlineOrders ?? []) as Row[]) {
      created.push(
        await this.createNotification({
          organizationId,
          type: "online_order",
          title: "Online order",
          body: `Online order ${str(o.order_number ?? o.id)} received.`,
          severity: "info",
          entityType: "sales_order",
          entityId: str(o.id),
          channels: ["in_app"],
          metadata: {},
        }),
      );
    }

    // Approvals pending
    const { data: approvals } = await this.db
      .from("approval_requests")
      .select("id,title,status")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .limit(30);
    for (const a of (approvals ?? []) as Row[]) {
      created.push(
        await this.createNotification({
          organizationId,
          type: "approval_request",
          title: "Approval request",
          body: str(a.title ?? a.id),
          severity: "warning",
          entityType: "approval",
          entityId: str(a.id),
          channels: ["in_app"],
          metadata: {},
        }),
      );
    }

    return { createdCount: created.length, items: created.slice(0, 20) };
  }
}
