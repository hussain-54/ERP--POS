import { Router } from "express";
import {
  CreateB2bOrderSchema,
  CreateB2bPortalUserSchema,
  CreateCampaignSchema,
  CreateLoyaltyOfferSchema,
  CreateSegmentSchema,
  EarnLoyaltyPointsSchema,
  RedeemLoyaltyPointsSchema,
  StoreCheckoutSchema,
  UpsertStoreSettingsSchema,
} from "@electronic-erp/contracts";
import { CommerceRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const commerceRouter = Router();

function repo(req: AuthedRequest): CommerceRepository {
  return new CommerceRepository(createUserClient(req.accessToken!));
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

// ─── CRM ─────────────────────────────────────────────────
commerceRouter.post("/crm/segments", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["crm.manage"]);
    const input = CreateSegmentSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createSegment(input) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get("/crm/segments", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["crm.view", "crm.manage"]);
    res.json({ items: await repo(req).listSegments(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.post(
  "/crm/segments/:id/refresh",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["crm.manage"]);
      res.json(await repo(req).refreshSegmentMembers(orgId(req), req.params.id!));
    } catch (err) {
      next(err);
    }
  },
);

commerceRouter.get(
  "/crm/customers/:customerId/profile",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["crm.view", "crm.manage", "customers.read"]);
      res.json(await repo(req).customerCrmProfile(orgId(req), req.params.customerId!));
    } catch (err) {
      next(err);
    }
  },
);

commerceRouter.post("/crm/campaigns", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["crm.manage"]);
    const input = CreateCampaignSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createCampaign(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get("/crm/campaigns", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["crm.view", "crm.manage"]);
    res.json({ items: await repo(req).listCampaigns(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.post(
  "/crm/campaigns/:id/run",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["crm.manage"]);
      res.json(await repo(req).runCampaign(orgId(req), req.params.id!));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Loyalty ─────────────────────────────────────────────
commerceRouter.post("/loyalty/tiers/seed", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["loyalty.manage"]);
    res.json({ items: await repo(req).seedLoyaltyTiers(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get(
  "/loyalty/accounts/:customerId",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["loyalty.view", "loyalty.manage", "loyalty.redeem"]);
      res.json({
        item: await repo(req).getLoyaltyAccount(orgId(req), req.params.customerId!),
      });
    } catch (err) {
      next(err);
    }
  },
);

commerceRouter.post("/loyalty/earn", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["loyalty.manage", "pos.sell"]);
    const input = EarnLoyaltyPointsSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({ item: await repo(req).earnPoints(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.post("/loyalty/redeem", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["loyalty.redeem", "loyalty.manage"]);
    const input = RedeemLoyaltyPointsSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({ item: await repo(req).redeemPoints(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get(
  "/loyalty/ledger/:customerId",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["loyalty.view", "loyalty.manage"]);
      res.json({
        items: await repo(req).listLoyaltyLedger(orgId(req), req.params.customerId!),
      });
    } catch (err) {
      next(err);
    }
  },
);

commerceRouter.post("/loyalty/offers", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["loyalty.manage"]);
    const input = CreateLoyaltyOfferSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createLoyaltyOffer(input) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get("/loyalty/offers", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["loyalty.view", "loyalty.manage", "loyalty.redeem"]);
    res.json({ items: await repo(req).listLoyaltyOffers(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

// ─── B2B ─────────────────────────────────────────────────
commerceRouter.post("/b2b/users", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["b2b.manage"]);
    const input = CreateB2bPortalUserSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createB2bPortalUser(input) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get("/b2b/users", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["b2b.manage"]);
    res.json({ items: await repo(req).listB2bUsers(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get(
  "/b2b/customers/:customerId/portal",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["b2b.manage", "b2b.order", "customers.read"]);
      res.json(await repo(req).b2bCustomerPortal(orgId(req), req.params.customerId!));
    } catch (err) {
      next(err);
    }
  },
);

commerceRouter.post("/b2b/pricing", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["b2b.order", "b2b.manage", "pricing.read"]);
    const customerId = String(req.body.customerId ?? "");
    const productIds = Array.isArray(req.body.productIds) ? req.body.productIds.map(String) : [];
    res.json({ items: await repo(req).b2bPricing(orgId(req), customerId, productIds) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.post("/b2b/orders", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["b2b.order", "b2b.manage", "orders.write"]);
    const input = CreateB2bOrderSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await repo(req).createB2bOrder(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.post(
  "/b2b/orders/:id/approve",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["b2b.approve", "b2b.manage", "approvals.act"]);
      const approve = req.body?.approve !== false;
      res.json({ item: await repo(req).approveB2bOrder(orgId(req), req.params.id!, approve) });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Online store ────────────────────────────────────────
commerceRouter.put("/store/settings", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["store.manage"]);
    const input = UpsertStoreSettingsSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json({ item: await repo(req).upsertStoreSettings(input) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get("/store/settings", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["store.manage", "store.order"]);
    res.json({ item: await repo(req).getStoreSettings(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get("/store/catalog", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    // Catalog browse uses ERP product + stock — authenticated staff/store channel
    assertAny(req, ["store.manage", "store.order", "products.read"]);
    res.json({
      items: await repo(req).storeCatalog(orgId(req), {
        categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
        brandId: typeof req.query.brandId === "string" ? req.query.brandId : undefined,
      }),
    });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get(
  "/store/products/:productId",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["store.manage", "store.order", "products.read"]);
      res.json(await repo(req).storeProductDetail(orgId(req), req.params.productId!));
    } catch (err) {
      next(err);
    }
  },
);

commerceRouter.post("/store/checkout", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["store.order", "store.manage", "orders.write"]);
    const input = StoreCheckoutSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).storeCheckout(input, userId(req)));
  } catch (err) {
    next(err);
  }
});
