import { Router } from "express";
import {
  CreateSaleReturnSchema,
  CreateSaleSchema,
  ProductSearchQuerySchema,
  type ApproverRole,
} from "@electronic-erp/contracts";
import { PosRepository } from "@electronic-erp/db";
import { AuthorizationService, ForbiddenDomainError } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

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

/** Server-derived discount ceiling — never trust client approverRole alone. */
function discountRoleFromAuthz(z: AuthorizationService): ApproverRole | null {
  if (z.can("pos.discount_special")) return "special";
  if (z.can("pos.discount_owner")) return "owner";
  if (z.can("pos.discount_manager")) return "manager";
  if (z.can("pos.discount_supervisor")) return "supervisor";
  if (z.can("pos.discount_cashier")) return "cashier";
  return null;
}

function saleHasDiscount(input: {
  discountTotal?: number;
  discounts?: Array<{ amount?: number; percent?: number }>;
  items: Array<{ discount?: number }>;
}): boolean {
  if ((input.discountTotal ?? 0) > 0) return true;
  if ((input.discounts ?? []).some((d) => (d.amount ?? 0) > 0 || (d.percent ?? 0) > 0)) return true;
  return input.items.some((i) => (i.discount ?? 0) > 0);
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
    res.status(201).json(
      await repo(req).holdSale({
        organizationId: orgId(req),
        branchId: String(req.body.branchId),
        warehouseId: String(req.body.warehouseId),
        holdLabel: req.body.holdLabel,
        cartSnapshot: (req.body.cartSnapshot ?? {}) as Record<string, unknown>,
        deviceId: req.body.deviceId,
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
    res.json({ items: await repo(req).listHeldSales(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

posRouter.post("/holds/:id/resume", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("pos.hold");
    res.json(await repo(req).resumeHeldSale(req.params.id));
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
