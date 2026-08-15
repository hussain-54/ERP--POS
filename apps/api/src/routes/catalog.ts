import { Router } from "express";
import {
  BulkProductActionSchema,
  CreateAttributeDefinitionSchema,
  CreateBrandSchema,
  CreateCategorySchema,
  CreateCompanySchema,
  CreateProductMasterSchema,
  CreateProductModelSchema,
  CreateProductTypeSchema,
  CreateSubcategorySchema,
  CreateUnitConversionSchema,
  CreateUnitSchema,
  CreateVariantSchema,
  GenerateBarcodeSchema,
  ProductListQuerySchema,
  UpdateProductMasterSchema,
} from "@electronic-erp/contracts";
import { CatalogRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  CUSTOMER_IMPORT_TEMPLATE,
  ImportService,
  parseCsv,
  PRICE_IMPORT_TEMPLATE,
  PRODUCT_IMPORT_TEMPLATE,
  productsExportCsv,
  STOCK_IMPORT_TEMPLATE,
  SUPPLIER_IMPORT_TEMPLATE,
} from "../services/import-service.js";

/**
 * Catalog router — modules 02 Product Management, 03 Barcode & QR, 32 Import/Export (catalog templates).
 * Mount: /api/v1/catalog. Repository: CatalogRepository.
 */
export const catalogRouter = Router();
catalogRouter.use(requireAuth);

function repo(req: AuthedRequest): CatalogRepository {
  return new CatalogRepository(createUserClient(req.accessToken!));
}

function authz(req: AuthedRequest): AuthorizationService {
  return new AuthorizationService(req.authz!);
}

function orgId(req: AuthedRequest): string {
  return req.authz!.organizationId;
}

// 02 Product Management — taxonomy
const taxonomy = [
  ["categories", CreateCategorySchema, "createCategory"],
  ["subcategories", CreateSubcategorySchema, "createSubcategory"],
  ["brands", CreateBrandSchema, "createBrand"],
  ["companies", CreateCompanySchema, "createCompany"],
  ["product-types", CreateProductTypeSchema, "createProductType"],
  ["product-models", CreateProductModelSchema, "createProductModel"],
] as const;

for (const [pathName, schema, method] of taxonomy) {
  const table = pathName.replaceAll("-", "_");
  catalogRouter.get(`/${pathName}`, async (req: AuthedRequest, res, next) => {
    try {
      authz(req).assert("products.read");
      const rows = await repo(req).listTaxonomy(table, orgId(req), req.query.includeDeleted === "true");
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  });
  catalogRouter.post(`/${pathName}`, async (req: AuthedRequest, res, next) => {
    try {
      authz(req).assert("catalog_taxonomy.manage");
      const input = schema.parse({ ...req.body, organizationId: orgId(req) });
      const catalog = repo(req);
      const created = await catalog[method](input as never);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });
  catalogRouter.patch(`/${pathName}/:id`, async (req: AuthedRequest, res, next) => {
    try {
      authz(req).assert("catalog_taxonomy.manage");
      const updated = await repo(req).updateNamed(table, req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });
  catalogRouter.post(`/${pathName}/:id/deactivate`, async (req: AuthedRequest, res, next) => {
    try {
      authz(req).assert("catalog_taxonomy.manage");
      res.json(await repo(req).softDelete(table, req.params.id));
    } catch (err) {
      next(err);
    }
  });
  catalogRouter.post(`/${pathName}/:id/restore`, async (req: AuthedRequest, res, next) => {
    try {
      authz(req).assert("catalog_taxonomy.manage");
      res.json(await repo(req).restore(table, req.params.id));
    } catch (err) {
      next(err);
    }
  });
}

// 02 Product Management — units
catalogRouter.get("/units", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("units.manage");
    res.json({ items: await repo(req).listTaxonomy("units", orgId(req)) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/units/seed-system", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("units.manage");
    await repo(req).ensureSystemUnits(orgId(req));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/units", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("units.manage");
    const input = CreateUnitSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createUnit(input));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/unit-conversions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("units.manage");
    const input = CreateUnitConversionSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createUnitConversion(input));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/unit-conversions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("units.manage");
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    res.json({ items: await repo(req).listUnitConversions(orgId(req), productId) });
  } catch (err) {
    next(err);
  }
});

// Attributes
catalogRouter.post("/attribute-definitions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    const input = CreateAttributeDefinitionSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createAttributeDefinition(input));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/attribute-definitions", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.read");
    res.json({ items: await repo(req).listTaxonomy("attribute_definitions", orgId(req)) });
  } catch (err) {
    next(err);
  }
});

// 02 Product Management — products
catalogRouter.get("/products", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.read");
    const query = ProductListQuerySchema.parse(req.query);
    res.json(await repo(req).listProducts(orgId(req), query));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    const input = CreateProductMasterSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createProduct(input));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/products/:id", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.read");
    const product = await repo(req).getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

catalogRouter.patch("/products/:id", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    const input = UpdateProductMasterSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json(await repo(req).updateProduct(req.params.id, input));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products/bulk", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    const input = BulkProductActionSchema.parse(req.body);
    res.json(await repo(req).bulkAction(input.ids, input.action));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products/:id/deactivate", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.delete");
    res.json(await repo(req).softDelete("products", req.params.id));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products/:id/restore", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    res.json(await repo(req).restore("products", req.params.id));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products/:id/variants", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    const input = CreateVariantSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      productId: req.params.id,
    });
    res.status(201).json(await repo(req).createVariant(input));
  } catch (err) {
    next(err);
  }
});

// 03 Barcode & QR
catalogRouter.post("/barcodes/generate", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("barcodes.manage");
    const input = GenerateBarcodeSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).generateBarcode(input));
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/barcodes/bulk-generate", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("barcodes.manage");
    const ids = zUuidArray(req.body.productIds);
    const created = [];
    for (const productId of ids) {
      created.push(
        await repo(req).generateBarcode({
          organizationId: orgId(req),
          productId,
          codeType: "code128",
          isPrimary: false,
        }),
      );
    }
    res.status(201).json({ items: created });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/barcodes", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("barcodes.manage");
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    res.json({ items: await repo(req).listBarcodes(orgId(req), productId) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/qr/generate", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("barcodes.manage");
    const productId = String(req.body.productId ?? "");
    if (!productId) throw new Error("productId required");
    res.status(201).json(
      await repo(req).generateQr({
        organizationId: orgId(req),
        productId,
        variantId: req.body.variantId ? String(req.body.variantId) : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/price-levels", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.read");
    res.json({ items: await repo(req).listPriceLevels(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/price-levels", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    res.status(201).json(
      await repo(req).createPriceLevel({
        organizationId: orgId(req),
        code: String(req.body.code ?? ""),
        name: String(req.body.name ?? ""),
      }),
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/products/:id/prices", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.read");
    res.json({ items: await repo(req).listProductPrices(req.params.id) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products/:id/prices", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.write");
    res.status(201).json(
      await repo(req).setProductPrice({
        organizationId: orgId(req),
        productId: req.params.id,
        unitId: String(req.body.unitId ?? ""),
        amount: Number(req.body.amount ?? 0),
        priceLevelId: req.body.priceLevelId ? String(req.body.priceLevelId) : undefined,
        customerId: req.body.customerId ? String(req.body.customerId) : undefined,
        variantId: req.body.variantId ? String(req.body.variantId) : undefined,
        branchId: req.body.branchId ? String(req.body.branchId) : undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/products/:id/media", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.read");
    res.json({ items: await repo(req).listMedia(req.params.id) });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/products/:id/media", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.manage_media");
    const body = req.body as {
      mediaType: string;
      storagePath: string;
      fileName: string;
      mimeType?: string;
      fileSize?: number;
      isPrimary?: boolean;
    };
    res.status(201).json(
      await repo(req).addMedia({
        organizationId: orgId(req),
        productId: req.params.id,
        ...body,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// 32 Import / Export — catalog templates (also on infrastructureRouter)
catalogRouter.get("/import/templates/:entity", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.import");
    const map: Record<string, string> = {
      products: PRODUCT_IMPORT_TEMPLATE,
      customers: CUSTOMER_IMPORT_TEMPLATE,
      suppliers: SUPPLIER_IMPORT_TEMPLATE,
      stock: STOCK_IMPORT_TEMPLATE,
      prices: PRICE_IMPORT_TEMPLATE,
    };
    const tpl = map[req.params.entity];
    if (!tpl) {
      res.status(404).json({ error: "Unknown template" });
      return;
    }
    res.type("text/csv").send(tpl);
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/import/products", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.import");
    const csv = String(req.body.csv ?? "");
    const rows = parseCsv(csv);
    const result = await new ImportService(repo(req)).importProducts(orgId(req), rows);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/export/products", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("products.export");
    const products = await repo(req).exportProducts(orgId(req));
    res.type("text/csv").send(productsExportCsv(products));
  } catch (err) {
    next(err);
  }
});

function zUuidArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("productIds required");
  return value.map(String);
}
