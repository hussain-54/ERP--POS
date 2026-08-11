import { Router } from "express";
import {
  CreateBatchSchema,
  CreateReservationSchema,
  CreateSerialSchema,
  CreateStockAdjustmentSchema,
  CreateStockCountSessionSchema,
  CreateWarehouseSchema,
  PostStockMovementSchema,
  UpsertStockCountLineSchema,
} from "@electronic-erp/contracts";
import { InventoryRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

function repo(req: AuthedRequest): InventoryRepository {
  return new InventoryRepository(createUserClient(req.accessToken!));
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

inventoryRouter.get("/warehouses", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.view");
    res.json({ items: await repo(req).listWarehouses(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/warehouses", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warehouses.manage");
    const input = CreateWarehouseSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(
      await repo(req).createWarehouse({
        ...input,
        allowNegativeStock: Boolean(req.body.allowNegativeStock),
      }),
    );
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/balances", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.view");
    const warehouseId = typeof req.query.warehouseId === "string" ? req.query.warehouseId : undefined;
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    res.json({ items: await repo(req).listBalances(orgId(req), { warehouseId, productId }) });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/movements", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.view");
    res.json({
      items: await repo(req).listMovements(orgId(req), {
        productId: typeof req.query.productId === "string" ? req.query.productId : undefined,
        warehouseId: typeof req.query.warehouseId === "string" ? req.query.warehouseId : undefined,
        serialNumberId: typeof req.query.serialNumberId === "string" ? req.query.serialNumberId : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      }),
    });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/movements", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.adjust");
    const input = PostStockMovementSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).postMovement(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/adjustments", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.adjust");
    const input = CreateStockAdjustmentSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createAdjustmentRequest(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/adjustments/:id/approve", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.approve_adjust");
    res.json(await repo(req).approveAdjustment(req.params.id, userId(req), true));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/batches", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.batch");
    const input = CreateBatchSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createBatch(input));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/serials", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.serial");
    const input = CreateSerialSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createSerial(input));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/serials/:id/history", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.serial");
    res.json({ items: await repo(req).listSerialHistory(req.params.id) });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/reservations", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.reserve");
    const input = CreateReservationSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createReservation(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/reservations/:id/release", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.reserve");
    const operationId = String(req.body.operationId ?? "");
    if (!operationId) throw new Error("operationId required");
    res.json(await repo(req).releaseReservation(req.params.id, operationId, userId(req)));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/counts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.count");
    const input = CreateStockCountSessionSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createCountSession(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/counts/:id/lines", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.count");
    const input = UpsertStockCountLineSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      sessionId: req.params.id,
    });
    res.status(201).json(await repo(req).upsertCountLine(input));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/counts/:id/lines", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.view");
    res.json({ items: await repo(req).listCountLines(req.params.id) });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/counts/:id/approve", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.approve_count");
    res.json(await repo(req).approveAndPostCount(req.params.id, userId(req)));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post("/costing/ensure", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("inventory.view");
    const method = typeof req.body.method === "string" ? req.body.method : "moving_average";
    res.json(await repo(req).ensureCostingSettings(orgId(req), method));
  } catch (err) {
    next(err);
  }
});
