import { Router } from "express";
import {
  CreateDocumentSchema,
  CreateEmployeeSchema,
  CreateIncentiveSchema,
  CreateNotificationSchema,
  CreateSalaryRunSchema,
  CreateSaleReferenceSchema,
  CreateTaxDocumentSchema,
  PayCommissionSchema,
  ScanNotificationsSchema,
  TaxRateSchema,
  UpdateEmployeeSchema,
  UpdateSaleReferenceSchema,
  UpsertAttendanceSchema,
  UpsertPerformanceSchema,
  UpsertTaxProfileSchema,
  VoidCommissionForSaleSchema,
} from "@electronic-erp/contracts";
import { EnterpriseRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

/**
 * Enterprise router — modules 20 Salesmen, 31 Tax, 24 Documents, 29 Notifications, 39 System HR.
 * Mount: /api/v1 (hr, references, commissions, tax, documents, notifications).
 * Repository: EnterpriseRepository.
 */
export const enterpriseRouter = Router();

function repo(req: AuthedRequest): EnterpriseRepository {
  return new EnterpriseRepository(createUserClient(req.accessToken!));
}
function authz(req: AuthedRequest): AuthorizationService {
  return new AuthorizationService(req.authz!);
}
function orgId(req: AuthedRequest): string {
  return req.authz!.organizationId;
}
function userId(req: AuthedRequest): string | null {
  return req.authz?.userId ?? null;
}
function assertAny(req: AuthedRequest, keys: string[]) {
  const a = authz(req);
  if (!keys.some((k) => a.can(k))) a.assert(keys[0]!);
}

// ─── 39 System HR / 20 Salesmen (employees + commissions) ─
enterpriseRouter.post("/hr/employees", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.manage"]);
    const input = CreateEmployeeSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createEmployee(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/hr/employees", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.view", "hr.manage", "hr.payroll", "salesman.manage", "pos.sell"]);
    res.json({ items: await repo(req).listEmployees(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.patch("/hr/employees/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.manage", "salesman.manage"]);
    const input = UpdateEmployeeSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      id: req.params.id,
    });
    res.json({ item: await repo(req).updateEmployee(input) });
  } catch (err) {
    next(err);
  }
});

// 20 Salesman / Field Sales — references
enterpriseRouter.post("/references", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["salesman.manage", "hr.manage", "pos.sell"]);
    const input = CreateSaleReferenceSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createSaleReference(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/references", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["salesman.manage", "hr.view", "hr.manage", "pos.sell", "commissions.view"]);
    const activeOnly = String(req.query.activeOnly ?? "") === "1";
    res.json({ items: await repo(req).listSaleReferences(orgId(req), activeOnly) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.patch("/references/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["salesman.manage", "hr.manage"]);
    const input = UpdateSaleReferenceSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      id: req.params.id,
    });
    res.json({ item: await repo(req).updateSaleReference(input) });
  } catch (err) {
    next(err);
  }
});

// 20 Salesman / Field Sales — commissions
enterpriseRouter.post("/commissions/pay", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["commissions.manage", "hr.payroll"]);
    const input = PayCommissionSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({ item: await repo(req).payCommission(input) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/commissions/void-for-sale", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["commissions.manage", "hr.payroll"]);
    const input = VoidCommissionForSaleSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({ item: await repo(req).voidCommissionForSale(input.organizationId, input.saleId) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/commissions/reports", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["commissions.view", "hr.view", "hr.payroll", "hr.manage"]);
    res.json(await repo(req).commissionReports(orgId(req)));
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/hr/attendance", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.manage"]);
    const input = UpsertAttendanceSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).upsertAttendance(input) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/hr/attendance", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.view", "hr.manage"]);
    res.json({
      items: await repo(req).listAttendance(orgId(req), String(req.query.employeeId ?? "") || undefined),
    });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/hr/salaries", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.payroll"]);
    const input = CreateSalaryRunSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createSalaryRun(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/hr/salaries", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.payroll", "hr.view"]);
    res.json({ items: await repo(req).listSalaryRuns(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/hr/incentives", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.manage", "hr.payroll"]);
    const input = CreateIncentiveSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createIncentive(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/hr/performance", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.manage"]);
    const input = UpsertPerformanceSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).upsertPerformance(input) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/hr/commissions", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["hr.view", "hr.payroll", "hr.manage", "commissions.view"]);
    res.json(
      await repo(req).salesmanCommissionSummary(orgId(req), {
        employeeId: String(req.query.employeeId ?? "") || undefined,
        userId: String(req.query.userId ?? "") || undefined,
        periodYm: String(req.query.periodYm ?? "") || undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// ─── 31 Tax & Pakistan Compliance ────────────────────────
enterpriseRouter.put("/tax/profile", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.manage"]);
    const input = UpsertTaxProfileSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({ item: await repo(req).upsertTaxProfile(input) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/tax/profile", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.view", "tax.manage"]);
    res.json({ item: await repo(req).getTaxProfile(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/tax/rates", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.manage"]);
    const input = TaxRateSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createTaxRate(input) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/tax/rates", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.view", "tax.manage", "pos.sell"]);
    res.json({ items: await repo(req).listTaxRates(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/tax/documents", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.manage", "tax.export"]);
    const input = CreateTaxDocumentSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createTaxDocument(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/tax/documents", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.view", "tax.manage", "tax.export"]);
    res.json({ items: await repo(req).listTaxDocuments(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/tax/reports", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["tax.view", "tax.export"]);
    res.json(await repo(req).taxReport(orgId(req)));
  } catch (err) {
    next(err);
  }
});

// ─── 24 Documents ───────────────────────────────────────
enterpriseRouter.post("/documents", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["documents.manage"]);
    const input = CreateDocumentSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createDocument(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.get("/documents", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["documents.view", "documents.manage"]);
    const canViewSensitive = authz(req).can("documents.manage");
    res.json({
      items: await repo(req).listDocuments(orgId(req), {
        entityType: String(req.query.entityType ?? "") || undefined,
        entityId: String(req.query.entityId ?? "") || undefined,
        canViewSensitive,
      }),
    });
  } catch (err) {
    next(err);
  }
});

// ─── 29 Notification Center ─────────────────────────────
enterpriseRouter.get("/notifications", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["notifications.view", "notifications.manage", "notifications.broadcast"]);
    res.json({ items: await repo(req).listNotifications(orgId(req), userId(req)) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post("/notifications", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["notifications.broadcast", "notifications.manage"]);
    const input = CreateNotificationSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createNotification(input) });
  } catch (err) {
    next(err);
  }
});

enterpriseRouter.post(
  "/notifications/:id/read",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["notifications.view", "notifications.manage"]);
      res.json(await repo(req).markRead(orgId(req), String(req.params.id), userId(req)));
    } catch (err) {
      next(err);
    }
  },
);

enterpriseRouter.post("/notifications/scan", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["notifications.manage", "notifications.broadcast"]);
    const input = ScanNotificationsSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json(
      await repo(req).scanAndEnqueue(orgId(req), {
        warehouseId: input.warehouseId,
        branchId: input.branchId,
      }),
    );
  } catch (err) {
    next(err);
  }
});
