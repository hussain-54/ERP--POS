import { Router } from "express";
import {
  AccountingReportKindSchema,
  BiMetricSchema,
  ProfitReportKindSchema,
  PurchaseReportDimensionSchema,
  ReportFilterSchema,
  SalesReportDimensionSchema,
  StockReportKindSchema,
} from "@electronic-erp/contracts";
import { AccountingRepository, ReportingRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

function reporting(req: AuthedRequest): ReportingRepository {
  return new ReportingRepository(createUserClient(req.accessToken!));
}
function accounting(req: AuthedRequest): AccountingRepository {
  return new AccountingRepository(createUserClient(req.accessToken!));
}
function authz(req: AuthedRequest): AuthorizationService {
  return new AuthorizationService(req.authz!);
}
function orgId(req: AuthedRequest): string {
  return req.authz!.organizationId;
}

function parseFilter(req: AuthedRequest) {
  const raw = {
    organizationId: orgId(req),
    period: req.query.period,
    from: req.query.from,
    to: req.query.to,
    branchId: req.query.branchId || undefined,
    warehouseId: req.query.warehouseId || undefined,
    salesmanUserId: req.query.salesmanUserId || undefined,
    categoryId: req.query.categoryId || undefined,
    brandId: req.query.brandId || undefined,
    partyId: req.query.partyId || undefined,
    limit: req.query.limit,
  };
  const filter = ReportFilterSchema.parse(raw);

  // Enforce branch scope unless user can view all branches
  const a = authz(req);
  const canAll =
    a.can("dashboard.view_all_branches") ||
    a.can("bi.view_all_branches") ||
    a.can("branches.view_all") ||
    a.canViewAllBranches();
  if (!canAll) {
    const allowed = req.authz!.branchIds;
    if (filter.branchId && !allowed.includes(filter.branchId)) {
      throw new Error("Forbidden: branch out of scope");
    }
    if (!filter.branchId && req.authz!.branchId) {
      filter.branchId = req.authz!.branchId;
    }
  }
  return filter;
}

function assertAny(req: AuthedRequest, keys: string[]) {
  const a = authz(req);
  if (!keys.some((k) => a.can(k))) {
    a.assert(keys[0]!);
  }
}

reportsRouter.get("/catalog", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["reports.view", "reports.finance", "dashboard.view", "bi.view"]);
    res.json({
      sales: SalesReportDimensionSchema.options,
      purchases: PurchaseReportDimensionSchema.options,
      stock: StockReportKindSchema.options,
      profit: ProfitReportKindSchema.options,
      accounting: AccountingReportKindSchema.options,
      bi: BiMetricSchema.options,
      periods: ["today", "yesterday", "week", "month", "year", "custom"],
      filters: ["branch", "warehouse", "salesman", "category", "brand", "date"],
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/dashboard/executive", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["dashboard.view", "reports.view"]);
    const filter = parseFilter(req);
    res.json(await reporting(req).executiveDashboard(orgId(req), filter));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/sales/:dimension", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["reports.sales", "reports.view"]);
    const dimension = SalesReportDimensionSchema.parse(req.params.dimension);
    res.json(await reporting(req).salesReport(orgId(req), dimension, parseFilter(req)));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/purchases/:dimension", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["reports.purchases", "reports.view"]);
    const dimension = PurchaseReportDimensionSchema.parse(req.params.dimension);
    res.json(await reporting(req).purchaseReport(orgId(req), dimension, parseFilter(req)));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/stock/:kind", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["reports.stock", "reports.view", "inventory.view"]);
    const kind = StockReportKindSchema.parse(req.params.kind);
    res.json(await reporting(req).stockReport(orgId(req), kind, parseFilter(req)));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/profit/:kind", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["reports.profit", "reports.view", "reports.finance"]);
    const kind = ProfitReportKindSchema.parse(req.params.kind);
    res.json(await reporting(req).profitReport(orgId(req), kind, parseFilter(req)));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/bi/:metric", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["bi.view", "reports.view"]);
    const metric = BiMetricSchema.parse(req.params.metric);
    res.json(await reporting(req).biMetric(orgId(req), metric, parseFilter(req)));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/accounting/:kind", async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["reports.finance", "reports.view", "ledgers.view"]);
    const kind = AccountingReportKindSchema.parse(req.params.kind);
    const filter = parseFilter(req);
    const repo = accounting(req);
    const oid = orgId(req);
    const qsFrom = typeof req.query.from === "string" ? req.query.from : undefined;
    const qsTo = typeof req.query.to === "string" ? req.query.to : undefined;

    if (kind === "trial_balance") {
      res.json({ kind, data: await repo.reportTrialBalance(oid, qsFrom, qsTo) });
      return;
    }
    if (kind === "profit_loss") {
      res.json({ kind, data: await repo.reportProfitAndLoss(oid, qsFrom, qsTo) });
      return;
    }
    if (kind === "cash_book") {
      res.json({ kind, data: await repo.reportCashBook(oid, qsFrom, qsTo) });
      return;
    }
    if (kind === "bank_book") {
      const bankAccountId =
        typeof req.query.bankAccountId === "string" ? req.query.bankAccountId : undefined;
      res.json({ kind, data: await repo.reportBankBook(oid, bankAccountId, qsFrom, qsTo) });
      return;
    }
    if (kind === "receivables") {
      res.json({ kind, data: await repo.reportReceivables(oid) });
      return;
    }
    if (kind === "payables") {
      res.json({ kind, data: await repo.reportPayables(oid) });
      return;
    }
    if (kind === "expenses") {
      const period =
        typeof req.query.expensePeriod === "string"
          ? (req.query.expensePeriod as "daily" | "monthly" | "yearly")
          : "monthly";
      res.json({ kind, data: await repo.reportExpenses(oid, period) });
      return;
    }
    if (kind === "customer_ledger") {
      if (!filter.partyId) throw new Error("partyId required for customer ledger");
      res.json({ kind, data: await repo.reportCustomerLedger(oid, filter.partyId) });
      return;
    }
    if (kind === "supplier_ledger") {
      if (!filter.partyId) throw new Error("partyId required for supplier ledger");
      res.json({ kind, data: await repo.reportSupplierLedger(oid, filter.partyId) });
      return;
    }
    res.status(400).json({ error: "Unknown accounting report" });
  } catch (err) {
    next(err);
  }
});
