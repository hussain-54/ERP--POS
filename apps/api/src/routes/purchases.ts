import { Router } from "express";
import {
  CreateBinSchema,
  CreateDeliverySchema,
  CreatePurchaseReturnSchema,
  CreatePurchaseSchema,
  CreateRackSchema,
  CreateShelfSchema,
  CreateStockTransferSchema,
  DeliveryStatusSchema,
  TransferStatusSchema,
} from "@electronic-erp/contracts";
import { PurchasesRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { z } from "zod";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const purchasesRouter = Router();
purchasesRouter.use(requireAuth);

function repo(req: AuthedRequest): PurchasesRepository {
  return new PurchasesRepository(createUserClient(req.accessToken!));
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

purchasesRouter.post("/invoices", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("purchases.write");
    const input = CreatePurchaseSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).postPurchase(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/invoices", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("purchases.read");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listPurchases(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/returns", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("purchases.return");
    const input = CreatePurchaseReturnSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).postPurchaseReturn(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/supplier-prices", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("purchases.prices");
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    res.json({ items: await repo(req).listSupplierPrices(orgId(req), productId) });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/supplier-prices/history", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("purchases.prices");
    const productId = z.string().uuid().parse(req.query.productId);
    res.json({ items: await repo(req).listPriceHistory(orgId(req), productId) });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/locations/racks", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warehouses.manage");
    const input = CreateRackSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createRack(input));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/locations/shelves", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warehouses.manage");
    const input = CreateShelfSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createShelf(input));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/locations/bins", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warehouses.manage");
    const input = CreateBinSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createBin(input));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/locations", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warehouses.manage");
    const warehouseId = z.string().uuid().parse(req.query.warehouseId);
    res.json(await repo(req).listLocations(orgId(req), warehouseId));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/transfers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.transfer");
    const input = CreateStockTransferSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createTransfer(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/transfers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.transfer");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listTransfers(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/transfers/:id/advance", async (req: AuthedRequest, res, next) => {
  try {
    const to = TransferStatusSchema.parse(req.body.status);
    if (to === "approved") authz(req).assert("transfers.approve");
    else if (to === "dispatched" || to === "in_transit") authz(req).assert("transfers.dispatch");
    else if (to === "received") authz(req).assert("transfers.receive");
    else authz(req).assert("inventory.transfer");
    res.json(await repo(req).advanceTransfer(req.params.id!, to, userId(req)));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/deliveries", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("deliveries.manage");
    const input = CreateDeliverySchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createDelivery(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/deliveries", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("deliveries.manage");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listDeliveries(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post("/deliveries/:id/advance", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("deliveries.manage");
    const to = DeliveryStatusSchema.parse(req.body.status);
    res.json(await repo(req).advanceDelivery(req.params.id!, to));
  } catch (err) {
    next(err);
  }
});
