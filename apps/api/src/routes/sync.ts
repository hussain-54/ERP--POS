import { Router } from "express";
import {
  RegisterDeviceSchema,
  ResolveSyncConflictSchema,
  SyncPullRequestSchema,
  SyncPushRequestSchema,
} from "@electronic-erp/contracts";
import { SyncRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const syncRouter = Router();
syncRouter.use(requireAuth);

function repo(req: AuthedRequest): SyncRepository {
  return new SyncRepository(createUserClient(req.accessToken!));
}
function authz(req: AuthedRequest): AuthorizationService {
  return new AuthorizationService(req.authz!);
}
function orgId(req: AuthedRequest): string {
  return req.authz!.organizationId;
}

syncRouter.post("/devices/register", async (req: AuthedRequest, res, next) => {
  try {
    if (!authz(req).can("devices.manage") && !authz(req).can("devices.register") && !authz(req).can("sync.manage")) {
      authz(req).assert("devices.manage");
    }
    const input = RegisterDeviceSchema.parse({ ...req.body, organizationId: orgId(req) });
    authz(req).assertBranch(input.branchId);
    res.status(201).json(await repo(req).registerDevice(input));
  } catch (err) {
    next(err);
  }
});

syncRouter.post("/push", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("sync.manage");
    const input = SyncPushRequestSchema.parse(req.body);
    res.json(await repo(req).push(orgId(req), input));
  } catch (err) {
    next(err);
  }
});

syncRouter.post("/pull", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("sync.manage");
    const input = SyncPullRequestSchema.parse(req.body);
    res.json(await repo(req).pull(orgId(req), input));
  } catch (err) {
    next(err);
  }
});

syncRouter.get("/conflicts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("sync.resolve");
    res.json({ items: await repo(req).listConflicts(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

syncRouter.post("/conflicts/:id/resolve", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("sync.resolve");
    const input = ResolveSyncConflictSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json(
      await repo(req).resolveConflict(req.params.id!, input, req.authz?.userId ?? null),
    );
  } catch (err) {
    next(err);
  }
});

syncRouter.get("/status", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("sync.manage");
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;
    res.json(await repo(req).status(orgId(req), deviceId));
  } catch (err) {
    next(err);
  }
});
