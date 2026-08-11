import { Router } from "express";
import {
  AddServicePartSchema,
  ConvertOrderToInvoiceSchema,
  CreateQuotationSchema,
  CreateSalesOrderSchema,
  CreateServiceJobSchema,
  CreateWarrantyClaimSchema,
  QuotationStatusSchema,
  SalesOrderStatusSchema,
  ServiceJobStatusSchema,
  WarrantyLookupQuerySchema,
  WarrantyReplacementSchema,
} from "@electronic-erp/contracts";
import { AfterSalesRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const afterSalesRouter = Router();
afterSalesRouter.use(requireAuth);

function repo(req: AuthedRequest): AfterSalesRepository {
  return new AfterSalesRepository(createUserClient(req.accessToken!));
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

// Quotations
afterSalesRouter.post("/quotations", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("quotations.write");
    const input = CreateQuotationSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createQuotation(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.get("/quotations", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("quotations.read");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listQuotations(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/quotations/:id/advance", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("quotations.write");
    const to = QuotationStatusSchema.parse(req.body.status);
    res.json(await repo(req).advanceQuotation(req.params.id!, to));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/quotations/:id/convert-order", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("quotations.write");
    res.status(201).json(await repo(req).convertQuotationToOrder(req.params.id!, userId(req)));
  } catch (err) {
    next(err);
  }
});

// Orders
afterSalesRouter.post("/orders", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("orders.write");
    const input = CreateSalesOrderSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createSalesOrder(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.get("/orders", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("orders.read");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listOrders(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/orders/:id/advance", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("orders.write");
    const to = SalesOrderStatusSchema.parse(req.body.status);
    res.json(await repo(req).advanceOrder(req.params.id!, to));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/orders/:id/convert-invoice", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("orders.write");
    const input = ConvertOrderToInvoiceSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      orderId: req.params.id,
    });
    res.status(201).json(await repo(req).convertOrderToInvoice(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

// Service
afterSalesRouter.post("/service-jobs", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("service.manage");
    const input = CreateServiceJobSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createServiceJob(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.get("/service-jobs", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("service.manage");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listServiceJobs(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/service-jobs/:id/advance", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("service.manage");
    const to = ServiceJobStatusSchema.parse(req.body.status);
    res.json(await repo(req).advanceServiceJob(req.params.id!, to));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/service-jobs/:id/parts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("service.manage");
    const input = AddServicePartSchema.parse({
      ...req.body,
      organizationId: orgId(req),
      serviceJobId: req.params.id,
    });
    res.status(201).json(await repo(req).addServicePart(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.get("/service-jobs/:id/bill", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("service.manage");
    res.json(await repo(req).getServiceBill(req.params.id!));
  } catch (err) {
    next(err);
  }
});

// Warranty
afterSalesRouter.get("/warranties/lookup", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warranty.manage");
    const query = WarrantyLookupQuerySchema.parse(req.query);
    res.json({ items: await repo(req).lookupWarranty(orgId(req), query) });
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/warranty-claims", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warranty.manage");
    const input = CreateWarrantyClaimSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createWarrantyClaim(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.get("/warranty-claims", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warranty.manage");
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    res.json({ items: await repo(req).listWarrantyClaims(orgId(req), branchId) });
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.post("/warranty-replacements", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warranty.manage");
    const input = WarrantyReplacementSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).postWarrantyReplacement(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

afterSalesRouter.get("/warranty-replacements", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("warranty.manage");
    const saleWarrantyId = String(req.query.saleWarrantyId ?? "");
    res.json({ items: await repo(req).listReplacementHistory(saleWarrantyId) });
  } catch (err) {
    next(err);
  }
});
