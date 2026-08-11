import { Router } from "express";
import {
  CreateSaleReturnSchema,
  CreateSaleSchema,
  ProductSearchQuerySchema,
} from "@electronic-erp/contracts";
import { PosRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
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
    authz(req).assert("pos.sell");
    const input = CreateSaleSchema.parse({ ...req.body, organizationId: orgId(req) });
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
