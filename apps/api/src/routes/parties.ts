import { Router } from "express";
import {
  CreateCreditApprovalSchema,
  CreateCustomerSchema,
  CreateInstallmentPlanSchema,
  CreatePaymentMethodSchema,
  CreateSupplierSchema,
  PostSplitPaymentSchema,
  UpdateCustomerSchema,
} from "@electronic-erp/contracts";
import { PartiesRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

/**
 * Parties router — modules 12 Customers, 13 Suppliers, 22 Installments, 05 Sales payments.
 * Shared on purpose. Mount: /api/v1/parties. Repository: PartiesRepository.
 */
export const partiesRouter = Router();
partiesRouter.use(requireAuth);

function repo(req: AuthedRequest): PartiesRepository {
  return new PartiesRepository(createUserClient(req.accessToken!));
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

// 12 Customers
partiesRouter.get("/customers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("customers.read");
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json({ items: await repo(req).listCustomers(orgId(req), q) });
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/customers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("customers.write");
    const input = CreateCustomerSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createCustomer(input));
  } catch (err) {
    next(err);
  }
});

partiesRouter.get("/customers/:id", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("customers.read");
    const customer = await repo(req).getCustomer(req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

partiesRouter.patch("/customers/:id", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("customers.write");
    const patch = UpdateCustomerSchema.parse(req.body);
    res.json(await repo(req).updateCustomer(req.params.id, patch));
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/customers/:id/block", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("credit.manage");
    res.json(await repo(req).setCustomerBlocked(req.params.id, true));
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/customers/:id/unblock", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("credit.manage");
    res.json(await repo(req).setCustomerBlocked(req.params.id, false));
  } catch (err) {
    next(err);
  }
});

partiesRouter.get("/customers/:id/ledger", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("ledgers.view");
    res.json({
      items: await repo(req).listLedger({ organizationId: orgId(req), customerId: req.params.id }),
    });
  } catch (err) {
    next(err);
  }
});

partiesRouter.get("/customers/:id/payments", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("customers.read");
    res.json({ items: await repo(req).listPayments(orgId(req), req.params.id) });
  } catch (err) {
    next(err);
  }
});

partiesRouter.get("/customers/:id/installments", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("installments.manage");
    res.json({ items: await repo(req).listInstallmentPlans(req.params.id) });
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/customers/:id/ledger", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("customers.write");
    res.status(201).json(
      await repo(req).postCustomerLedger({
        organizationId: orgId(req),
        branchId: typeof req.body.branchId === "string" ? req.body.branchId : undefined,
        customerId: req.params.id,
        entryType: req.body.entryType,
        amount: String(req.body.amount),
        sourceType: String(req.body.sourceType ?? "manual"),
        sourceId: String(req.body.sourceId ?? crypto.randomUUID()),
        description: req.body.description,
        userId: userId(req),
      }),
    );
  } catch (err) {
    next(err);
  }
});

// 13 Suppliers
partiesRouter.get("/suppliers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("suppliers.read");
    res.json({ items: await repo(req).listSuppliers(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/suppliers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("suppliers.write");
    const input = CreateSupplierSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createSupplier(input));
  } catch (err) {
    next(err);
  }
});

partiesRouter.get("/suppliers/:id/ledger", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("ledgers.view");
    res.json({
      items: await repo(req).listLedger({ organizationId: orgId(req), supplierId: req.params.id }),
    });
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/suppliers/:id/ledger", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("suppliers.write");
    res.status(201).json(
      await repo(req).postSupplierLedger({
        organizationId: orgId(req),
        supplierId: req.params.id,
        entryType: req.body.entryType,
        amount: String(req.body.amount),
        sourceType: String(req.body.sourceType ?? "manual"),
        sourceId: String(req.body.sourceId ?? crypto.randomUUID()),
        description: req.body.description,
        userId: userId(req),
      }),
    );
  } catch (err) {
    next(err);
  }
});

// 05 POS / Sales — payment methods (Payments page)
partiesRouter.get("/payment-methods", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("payments.receive");
    res.json({ items: await repo(req).listPaymentMethods(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/payment-methods/seed", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("payments.configure");
    res.json({ items: await repo(req).ensureSystemPaymentMethods(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/payment-methods", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("payments.configure");
    const input = CreatePaymentMethodSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createPaymentMethod(input));
  } catch (err) {
    next(err);
  }
});

// 05 POS / Sales — split payments
partiesRouter.post("/payments", async (req: AuthedRequest, res, next) => {
  try {
    const direction = req.body.direction === "pay" ? "pay" : "receive";
    authz(req).assert(direction === "pay" ? "payments.pay" : "payments.receive");
    const input = PostSplitPaymentSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).postSplitPayment(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

// 12 Customers — credit / udhaar
partiesRouter.post("/credit/approvals", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("credit.manage");
    const input = CreateCreditApprovalSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).requestCreditApproval(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/credit/approvals/:id/approve", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("credit.approve");
    res.json(await repo(req).decideCreditApproval(req.params.id, true, userId(req)));
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/credit/approvals/:id/reject", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("credit.approve");
    res.json(await repo(req).decideCreditApproval(req.params.id, false, userId(req)));
  } catch (err) {
    next(err);
  }
});

partiesRouter.post("/credit/reminders/generate", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("credit.manage");
    const asOf = typeof req.body.asOfDate === "string" ? req.body.asOfDate : new Date().toISOString().slice(0, 10);
    res.json({ items: await repo(req).createOverdueReminders(orgId(req), asOf) });
  } catch (err) {
    next(err);
  }
});

// 22 Installments
partiesRouter.post("/installments", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("installments.manage");
    const input = CreateInstallmentPlanSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createInstallmentPlan(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

partiesRouter.get("/installments/:id/schedule", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("installments.manage");
    res.json({ items: await repo(req).listInstallmentSchedule(req.params.id) });
  } catch (err) {
    next(err);
  }
});
