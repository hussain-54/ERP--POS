import { Router } from "express";
import {
  CreateBackupJobSchema,
  CreateIntegrationClientSchema,
  CreateRestorePointSchema,
  RegisterSecurityDeviceSchema,
  RequestRestoreSchema,
  TwoFactorSetupSchema,
  UpsertSecuritySettingsSchema,
} from "@electronic-erp/contracts";
import {
  CatalogRepository,
  InfrastructureRepository,
  PartiesRepository,
} from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  CUSTOMER_IMPORT_TEMPLATE,
  ImportService,
  parseCsv,
  PRICE_IMPORT_TEMPLATE,
  PRODUCT_IMPORT_TEMPLATE,
  productsExport,
  STOCK_IMPORT_TEMPLATE,
  SUPPLIER_IMPORT_TEMPLATE,
} from "../services/import-service.js";

/**
 * Infrastructure router — modules 39 Security/Integrations, 34 Backup, 32 Import/Export.
 * Mount: /api/v1 (security, backup, integrations, data). Repository: InfrastructureRepository.
 */
export const infrastructureRouter = Router();

function infra(req: AuthedRequest): InfrastructureRepository {
  return new InfrastructureRepository(createUserClient(req.accessToken!));
}
function catalog(req: AuthedRequest): CatalogRepository {
  return new CatalogRepository(createUserClient(req.accessToken!));
}
function parties(req: AuthedRequest): PartiesRepository {
  return new PartiesRepository(createUserClient(req.accessToken!));
}
function importer(req: AuthedRequest): ImportService {
  return new ImportService(catalog(req), parties(req), undefined, infra(req));
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

// ─── 39 System — Security ────────────────────────────────
infrastructureRouter.get("/security/settings", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.view", "security.manage"]);
    res.json({ item: await infra(req).getSecuritySettings(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.put("/security/settings", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.manage"]);
    const input = UpsertSecuritySettingsSchema.parse({ ...req.body, organizationId: orgId(req) });
    const item = await infra(req).upsertSecuritySettings(input, userId(req));
    await infra(req).logActivity({
      organizationId: orgId(req),
      userId: userId(req),
      action: "security.settings_updated",
    });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/security/login-history", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.view", "security.manage", "audit.view"]);
    res.json({ items: await infra(req).listLoginHistory(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/security/sessions", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.view", "security.manage"]);
    res.json({ items: await infra(req).listSessions(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post(
  "/security/sessions/:id/revoke",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["security.manage"]);
      res.json({ item: await infra(req).revokeSession(orgId(req), String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  },
);

infrastructureRouter.get("/security/activity", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.view", "security.manage", "audit.view"]);
    res.json({ items: await infra(req).listActivity(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/security/devices", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.view", "security.manage", "devices.manage"]);
    res.json({ items: await infra(req).listDevices(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post("/security/devices", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.manage", "devices.register"]);
    const input = RegisterSecurityDeviceSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await infra(req).registerDevice(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post(
  "/security/devices/:id/:status",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["security.manage"]);
      const status = String(req.params.status);
      if (status !== "approved" && status !== "revoked") {
        res.status(400).json({ error: "status must be approved|revoked" });
        return;
      }
      res.json({
        item: await infra(req).setDeviceStatus(orgId(req), String(req.params.id), status),
      });
    } catch (err) {
      next(err);
    }
  },
);

infrastructureRouter.post("/security/2fa", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["security.manage"]);
    const input = TwoFactorSetupSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      userId: req.body.userId ?? userId(req),
    });
    res.json({ item: await infra(req).upsertTwoFactor(input) });
  } catch (err) {
    next(err);
  }
});

// ─── 34 Backup & Disaster Recovery ───────────────────────
infrastructureRouter.post("/backup/jobs", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["backup.manage"]);
    const input = CreateBackupJobSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await infra(req).createBackupJob(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/backup/jobs", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["backup.view", "backup.manage"]);
    res.json({ items: await infra(req).listBackupJobs(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post("/backup/restore-points", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["backup.manage"]);
    const input = CreateRestorePointSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json({ item: await infra(req).createRestorePoint(input, userId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/backup/restore-points", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["backup.view", "backup.manage", "backup.restore"]);
    res.json({ items: await infra(req).listRestorePoints(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post("/backup/restore", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["backup.restore"]);
    const input = RequestRestoreSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await infra(req).requestRestore(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

// ─── 39 System — Integrations ────────────────────────────
infrastructureRouter.post("/integrations/clients", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["integrations.manage"]);
    const input = CreateIntegrationClientSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await infra(req).createIntegrationClient(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/integrations/clients", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["integrations.view", "integrations.manage"]);
    res.json({
      items: await infra(req).listIntegrationClients(orgId(req)),
      apiBasePath: "/api/v1",
      audiences: [
        "mobile",
        "website",
        "payment_gateway",
        "bank",
        "courier",
        "whatsapp",
        "sms",
        "accounting",
        "ecommerce",
        "custom",
      ],
    });
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post(
  "/integrations/clients/:id/revoke",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      assertAny(req, ["integrations.manage"]);
      res.json({
        item: await infra(req).revokeIntegrationClient(orgId(req), String(req.params.id)),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── 32 Import / Export ──────────────────────────────────
infrastructureRouter.get("/data/import/templates/:entity", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["import.execute", "products.import"]);
    const map: Record<string, string> = {
      products: PRODUCT_IMPORT_TEMPLATE,
      customers: CUSTOMER_IMPORT_TEMPLATE,
      suppliers: SUPPLIER_IMPORT_TEMPLATE,
      stock: STOCK_IMPORT_TEMPLATE,
      prices: PRICE_IMPORT_TEMPLATE,
    };
    const tpl = map[String(req.params.entity)];
    if (!tpl) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    res.type("text/csv").send(tpl);
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.post("/data/import/:entity", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["import.execute", "products.import"]);
    const entity = String(req.params.entity);
    const rows = parseCsv(String(req.body.csv ?? ""));
    const svc = importer(req);
    const oid = orgId(req);
    let result;
    if (entity === "products") result = await svc.importProducts(oid, rows);
    else if (entity === "customers") result = await svc.importCustomers(oid, rows);
    else if (entity === "suppliers") result = await svc.importSuppliers(oid, rows);
    else if (entity === "stock") result = await svc.importStock(oid, rows);
    else if (entity === "prices") {
      const canWrite =
        authz(req).can("pricing.write") ||
        authz(req).can("products.write") ||
        authz(req).can("import.execute");
      result = await svc.importPrices(oid, rows, {
        canWritePricing: canWrite,
        userId: userId(req),
        reason: String(req.body.reason ?? "bulk_price_import"),
      });
    } else {
      res.status(404).json({ error: "Unknown import entity" });
      return;
    }
    await infra(req).logActivity({
      organizationId: oid,
      userId: userId(req),
      action: `import.${entity}`,
      detail: { imported: result.imported, failed: result.failed },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

infrastructureRouter.get("/data/export/products", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    assertAny(req, ["export.execute", "products.export"]);
    const format = String(req.query.format ?? "csv") as "csv" | "excel" | "pdf";
    const products = await catalog(req).exportProducts(orgId(req));
    const out = productsExport(
      products.map((p) => ({
        productCode: String((p as { productCode?: string }).productCode ?? ""),
        sku: String((p as { sku?: string }).sku ?? ""),
        name: String((p as { name?: string }).name ?? ""),
        costPrice: Number((p as { costPrice?: number }).costPrice ?? 0),
        retailPrice: Number((p as { retailPrice?: number }).retailPrice ?? 0),
        wholesalePrice: Number((p as { wholesalePrice?: number }).wholesalePrice ?? 0),
        dealerPrice: Number((p as { dealerPrice?: number }).dealerPrice ?? 0),
        minimumSalePrice: Number((p as { minimumSalePrice?: number }).minimumSalePrice ?? 0),
      })),
      format === "excel" || format === "pdf" ? format : "csv",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    res.type(out.contentType).send(out.body);
  } catch (err) {
    next(err);
  }
});
