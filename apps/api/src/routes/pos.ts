import { Router } from "express";
import {
  CreateSaleReturnSchema,
  CreateSaleSchema,
  EditHeldSaleSchema,
  HeldSaleFilterSchema,
  HoldSaleSchema,
  ProductSearchQuerySchema,
  SearchReturnInvoicesSchema,
  SaleListFilterSchema,
  TransferHeldSaleSchema,
  type ApproverRole,
} from "@electronic-erp/contracts";
import { PosRepository, PartiesRepository } from "@electronic-erp/db";
import {
  AuthorizationService,
  ForbiddenDomainError,
  assertPosCreditRemainderAllowed,
  assertPosInstallmentSaleAllowed,
  estimatePostedSaleRemaining,
  evaluateCustomerCreditForRemainder,
  posDiscountRoleFromPermissions,
} from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

/**
 * POS router — module 02 POS / SALES (terminal, holds, invoices, returns).
 * Mount: /api/v1/pos. Repository: PosRepository.
 */
export const posRouter = Router();
posRouter.use(requireAuth);

function repo(req: AuthedRequest): PosRepository {
  return new PosRepository(createUserClient(req.accessToken!));
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

function parties(req: AuthedRequest): PartiesRepository {
  return new PartiesRepository(createUserClient(req.accessToken!));
}

/** Server-derived discount ceiling — never trust client approverRole alone. */
function discountRoleFromAuthz(z: AuthorizationService): ApproverRole | null {
  return posDiscountRoleFromPermissions(z.context.permissions);
}

function saleHasDiscount(input: {
  discountTotal?: number;
  discounts?: Array<{ amount?: number; percent?: number }>;
  items: Array<{ discount?: number; discountPercent?: number }>;
}): boolean {
  if ((input.discountTotal ?? 0) > 0) return true;
  if ((input.discounts ?? []).some((d) => (d.amount ?? 0) > 0 || (d.percent ?? 0) > 0)) return true;
  return input.items.some((i) => (i.discount ?? 0) > 0 || (i.discountPercent ?? 0) > 0);
}

posRouter.get("/products/search", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.sell");
    const query = ProductSearchQuerySchema.parse(req.query);
    res.json({ items: await repo(req).searchProducts(orgId(req), query) });
  } catch (err) {
    next(err);
  }
});

posRouter.post("/sales", async (req: AuthedRequest, res, next) => {
  try {
    const z = authz(req);
    z.assert("pos.sell");
    let input = CreateSaleSchema.parse({ ...req.body, organizationId: orgId(req) });

    assertPosInstallmentSaleAllowed(z.can("installments.manage"), Boolean(input.createInstallment));

    const remaining = estimatePostedSaleRemaining(input);
    if (remaining > 0.009 && input.customerId) {
      const customer = await parties(req).getCustomer(input.customerId);
      const credit = customer
        ? evaluateCustomerCreditForRemainder({
            creditLimit: customer.creditLimit,
            outstanding: customer.outstanding,
            creditDays: customer.creditDays,
            isBlocked: customer.isBlocked,
            remaining,
          })
        : null;
      assertPosCreditRemainderAllowed({
        remaining,
        customerId: input.customerId,
        credit,
        canApproveOverLimit: z.can("credit.approve"),
      });
    }

    if (saleHasDiscount(input)) {
      const role = discountRoleFromAuthz(z);
      if (!role) {
        throw new ForbiddenDomainError(
          "Missing discount permission (pos.discount_cashier|supervisor|manager|owner|special)",
        );
      }
      const discounts =
        (input.discounts ?? []).length > 0
          ? (input.discounts ?? []).map((d) => ({ ...d, approverRole: role }))
          : (input.discountTotal ?? 0) > 0
            ? [
                {
                  scope: "invoice" as const,
                  kind: "fixed" as const,
                  amount: input.discountTotal ?? 0,
                  approverRole: role,
                  reason: "POS invoice discount",
                },
              ]
            : [
                {
                  scope: "item" as const,
                  kind: "fixed" as const,
                  amount: input.items.reduce((s, i) => s + (i.discount ?? 0), 0),
                  approverRole: role,
                  reason: "POS line discounts",
                },
              ];
      input = { ...input, discounts };
    }

    res.status(201).json(await repo(req).postSale(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

posRouter.get("/sales/management", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.view_invoices");
    const input = SaleListFilterSchema.parse({
      organizationId: orgId(req),
      branchId: req.query.branchId || undefined,
      warehouseId: req.query.warehouseId || undefined,
      tab: req.query.tab || "all",
      dateFrom: req.query.dateFrom || undefined,
      dateTo: req.query.dateTo || undefined,
      customerId: req.query.customerId || undefined,
      customerQuery: req.query.customerQuery || undefined,
      cashierUserId: req.query.cashierUserId || undefined,
      salesmanUserId: req.query.salesmanUserId || undefined,
      paymentMethodId: req.query.paymentMethodId || undefined,
      invoiceNumber: req.query.invoiceNumber || undefined,
      deviceId: req.query.deviceId || undefined,
      status: req.query.status || undefined,
      paymentStatus: req.query.paymentStatus || undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(await repo(req).searchSalesManagement(input));
  } catch (err) {
    next(err);
  }
});

posRouter.get("/sales/management/export", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.view_invoices");
    const input = SaleListFilterSchema.parse({
      organizationId: orgId(req),
      branchId: req.query.branchId || undefined,
      warehouseId: req.query.warehouseId || undefined,
      tab: req.query.tab || "all",
      dateFrom: req.query.dateFrom || undefined,
      dateTo: req.query.dateTo || undefined,
      customerId: req.query.customerId || undefined,
      customerQuery: req.query.customerQuery || undefined,
      cashierUserId: req.query.cashierUserId || undefined,
      salesmanUserId: req.query.salesmanUserId || undefined,
      paymentMethodId: req.query.paymentMethodId || undefined,
      invoiceNumber: req.query.invoiceNumber || undefined,
      deviceId: req.query.deviceId || undefined,
      status: req.query.status || undefined,
      paymentStatus: req.query.paymentStatus || undefined,
      limit: 5000,
      offset: 0,
    });
    const csv = await repo(req).exportSalesManagementCsv(input);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="sales-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

posRouter.get("/sales", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.view_invoices");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listSales(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

posRouter.get("/sales/:id/invoice", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.view_invoices");
    res.json(await repo(req).getInvoice(req.params.id));
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    const input = HoldSaleSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(
      await repo(req).holdSale({
        organizationId: input.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        holdLabel: input.holdLabel,
        holdReason: input.holdReason,
        notes: input.notes,
        customerId: input.customerId,
        cartSnapshot: input.cartSnapshot as Record<string, unknown>,
        deviceId: input.deviceId,
        expiresAt: input.expiresAt,
        userId: userId(req),
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.get("/holds", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    const branchId = String(req.query.branchId ?? req.authz?.branchId ?? "");
    if (!branchId) throw new Error("branchId required");
    const filter = HeldSaleFilterSchema.catch("all_pending").parse(req.query.filter ?? "all_pending");
    res.json({
      items: await repo(req).listHeldSales(orgId(req), branchId, {
        filter,
        userId: userId(req),
        resumeAny: authz(req).can("pos.resume_any"),
      }),
    });
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/expire", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    const branchId = req.body?.branchId ? String(req.body.branchId) : undefined;
    const count = await repo(req).expireDueHolds(orgId(req), branchId);
    res.json({ expired: count });
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/:id/resume", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    res.json(
      await repo(req).resumeHeldSale(req.params.id, {
        actorUserId: userId(req),
        resumeAny: authz(req).can("pos.resume_any"),
        checkout: Boolean(req.body?.checkout),
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.patch("/holds/:id", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    const input = EditHeldSaleSchema.parse(req.body ?? {});
    res.json(
      await repo(req).editHeldSale(req.params.id, {
        ...input,
        actorUserId: userId(req),
        resumeAny: authz(req).can("pos.resume_any"),
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/:id/duplicate", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    const warehouseId = String(req.body?.warehouseId ?? "");
    if (!warehouseId) throw new Error("warehouseId required");
    res.status(201).json(
      await repo(req).duplicateHeldSale(req.params.id, {
        actorUserId: userId(req),
        deviceId: req.body?.deviceId ? String(req.body.deviceId) : null,
        warehouseId,
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/:id/transfer", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    const input = TransferHeldSaleSchema.parse(req.body ?? {});
    res.json(
      await repo(req).transferHeldSale(req.params.id, {
        ...input,
        actorUserId: userId(req),
        resumeAny: authz(req).can("pos.resume_any"),
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/:id/cancel", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    res.json(
      await repo(req).cancelHeldSale(req.params.id, {
        actorUserId: userId(req),
        resumeAny: authz(req).can("pos.resume_any"),
        reason: req.body?.reason ? String(req.body.reason) : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/:id/discard", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    res.json(
      await repo(req).discardHeldSale(req.params.id, {
        actorUserId: userId(req),
        resumeAny: authz(req).can("pos.resume_any"),
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.get("/returns/search", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.return");
    const input = SearchReturnInvoicesSchema.parse({
      branchId: req.query.branchId ?? req.authz?.branchId,
      invoiceNumber: req.query.invoiceNumber,
      customerQuery: req.query.customerQuery,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });
    res.json({
      items: await repo(req).searchSalesForReturn({
        organizationId: orgId(req),
        ...input,
      }),
    });
  } catch (err) {
    next(err);
  }
});

posRouter.get("/returns", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.return");
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    const originalSaleId = req.query.originalSaleId
      ? String(req.query.originalSaleId)
      : undefined;
    res.json({
      items: await repo(req).listReturns(orgId(req), { branchId, originalSaleId }),
    });
  } catch (err) {
    next(err);
  }
});

posRouter.get("/returns/report", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.return");
    res.json(
      await repo(req).returnHistoryReport(orgId(req), {
        branchId: req.query.branchId ? String(req.query.branchId) : undefined,
        dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
        dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.get("/returns/sale/:saleId", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.return");
    res.json(await repo(req).getReturnableSale(req.params.saleId));
  } catch (err) {
    next(err);
  }
});

posRouter.post("/returns", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.return");
    const input = CreateSaleReturnSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).postReturn(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

posRouter.get("/shifts/current", async (req: AuthedRequest, res, next) => {
  try {
    if (!authz(req).can("pos.shift") && !authz(req).can("pos.sell")) authz(req).assert("pos.shift");
    const branchId = String(req.query.branchId ?? req.authz?.branchId ?? "");
    if (!branchId) throw new Error("branchId required");
    let shift = await repo(req).getOpenShift(orgId(req), branchId);
    if (shift) {
      shift = await repo(req).refreshShiftTotals(String(shift.id), orgId(req), branchId);
    }
    res.json({ item: shift });
  } catch (err) {
    next(err);
  }
});

posRouter.post("/shifts/open", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.shift");
    const branchId = String(req.body.branchId ?? req.authz?.branchId ?? "");
    if (!branchId) throw new Error("branchId required");
    authz(req).assertBranch(branchId);
    res.status(201).json(
      await repo(req).openShift({
        organizationId: orgId(req),
        branchId,
        openingFloat: Number(req.body.openingFloat ?? 0),
        notes: typeof req.body.notes === "string" ? req.body.notes : undefined,
        userId: userId(req),
      }),
    );
  } catch (err) {
    next(err);
  }
});

posRouter.post("/shifts/:id/close", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.shift");
    res.json(
      await repo(req).closeShift({
        shiftId: req.params.id!,
        closingCounted: Number(req.body.closingCounted ?? 0),
        notes: typeof req.body.notes === "string" ? req.body.notes : undefined,
        userId: userId(req),
      }),
    );
  } catch (err) {
    next(err);
  }
});
