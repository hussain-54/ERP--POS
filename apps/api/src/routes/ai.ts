import { Router } from "express";
import {
  AiInsightsQuerySchema,
  AiSettingsSchema,
  ConfirmRecognitionSchema,
  RecognizeProductSchema,
} from "@electronic-erp/contracts";
import { AiRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { AiService } from "../services/ai-service.js";

export const aiRouter = Router();

function service(req: AuthedRequest): AiService {
  return new AiService(new AiRepository(createUserClient(req.accessToken!)));
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

aiRouter.post("/ai/recognize-product", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["ai.recognize", "pos.sell"]);
    const input = RecognizeProductSchema.parse({
      ...req.body,
      organizationId: orgId(req),
    });
    res.status(201).json(await service(req).recognizeProduct(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

aiRouter.post("/ai/recognize-product/confirm", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["ai.recognize", "pos.sell"]);
    const input = ConfirmRecognitionSchema.parse({
      ...req.body,
      organizationId: orgId(req),
    });
    res.json(await service(req).confirmRecognition(input));
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/ai/insights", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["ai.insights", "bi.view", "reports.view"]);
    const input = AiInsightsQuerySchema.parse({
      organizationId: orgId(req),
      kind: req.query.kind,
      branchId: req.query.branchId || undefined,
      warehouseId: req.query.warehouseId || undefined,
      lookbackDays: req.query.lookbackDays ? Number(req.query.lookbackDays) : undefined,
      horizonDays: req.query.horizonDays ? Number(req.query.horizonDays) : undefined,
      velocity: {
        fastDays: req.query.fastDays ? Number(req.query.fastDays) : undefined,
        slowDays: req.query.slowDays ? Number(req.query.slowDays) : undefined,
        stagnantDays: req.query.stagnantDays ? Number(req.query.stagnantDays) : undefined,
      },
    });
    res.json(await service(req).buildInsights(input));
  } catch (err) {
    next(err);
  }
});

aiRouter.post("/ai/insights", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["ai.insights", "bi.view", "reports.view"]);
    const input = AiInsightsQuerySchema.parse({
      ...req.body,
      organizationId: orgId(req),
    });
    res.json(await service(req).buildInsights(input));
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/ai/settings", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["ai.manage", "ai.insights", "ai.recognize"]);
    res.json({ item: await service(req).getSettings(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

aiRouter.put("/ai/settings", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["ai.manage"]);
    const input = AiSettingsSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({
      item: await service(req).upsertSettings(
        orgId(req),
        {
          confidenceThreshold: input.confidenceThreshold,
          fastDays: input.velocity?.fastDays,
          slowDays: input.velocity?.slowDays,
          stagnantDays: input.velocity?.stagnantDays,
        },
        userId(req),
      ),
    });
  } catch (err) {
    next(err);
  }
});
