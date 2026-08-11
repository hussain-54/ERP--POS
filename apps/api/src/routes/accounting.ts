import { Router } from "express";
import {
  CreateAccountSchema,
  CreateBankAccountSchema,
  CreateExpenseSchema,
  CreateReconciliationSchema,
  CreateVoucherSchema,
  ImportBankStatementSchema,
  MatchBankLineSchema,
} from "@electronic-erp/contracts";
import { AccountingRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const accountingRouter = Router();
accountingRouter.use(requireAuth);

function repo(req: AuthedRequest): AccountingRepository {
  return new AccountingRepository(createUserClient(req.accessToken!));
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

accountingRouter.post("/coa/seed", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("accounts.write");
    res.json({ items: await repo(req).seedChartOfAccounts(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/accounts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("accounts.read");
    res.json({ items: await repo(req).listAccounts(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/accounts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("accounts.write");
    const input = CreateAccountSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createAccount(input));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/journals", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("accounts.read");
    res.json({ items: await repo(req).listJournals(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/vouchers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("accounts.write");
    const input = CreateVoucherSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createVoucher(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/vouchers", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("accounts.read");
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    res.json({ items: await repo(req).listVouchers(orgId(req), type) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/bank-accounts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("banking.manage");
    const input = CreateBankAccountSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createBankAccount(input));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/bank-accounts", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("banking.manage");
    res.json({ items: await repo(req).listBankAccounts(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/bank-statements/import", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("banking.manage");
    const input = ImportBankStatementSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).importBankStatement(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/bank-statements/:bankAccountId", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("banking.manage");
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({
      items: await repo(req).listStatementLines(orgId(req), req.params.bankAccountId!, status),
    });
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/bank-statements/match", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("banking.manage");
    const input = MatchBankLineSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.json(await repo(req).matchBankLine(input));
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/reconciliations", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("banking.manage");
    const input = CreateReconciliationSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createReconciliation(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

accountingRouter.post("/expenses", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("expenses.manage");
    const input = CreateExpenseSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).createExpense(input, userId(req)));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/expenses", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("expenses.manage");
    res.json({ items: await repo(req).listExpenses(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/expense-categories", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("expenses.manage");
    res.json({ items: await repo(req).listExpenseCategories(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/trial-balance", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    res.json({ items: await repo(req).reportTrialBalance(orgId(req), from, to) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/profit-loss", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    res.json(await repo(req).reportProfitAndLoss(orgId(req), from, to));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/cash-book", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    res.json(await repo(req).reportCashBook(orgId(req), from, to));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/bank-book", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const bankAccountId =
      typeof req.query.bankAccountId === "string" ? req.query.bankAccountId : undefined;
    res.json(await repo(req).reportBankBook(orgId(req), bankAccountId, from, to));
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/receivables", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    res.json({ items: await repo(req).reportReceivables(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/payables", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    res.json({ items: await repo(req).reportPayables(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/customer-ledger/:customerId", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    res.json({
      items: await repo(req).reportCustomerLedger(orgId(req), req.params.customerId!),
    });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/supplier-ledger/:supplierId", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    res.json({
      items: await repo(req).reportSupplierLedger(orgId(req), req.params.supplierId!),
    });
  } catch (err) {
    next(err);
  }
});

accountingRouter.get("/reports/expenses", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("reports.finance");
    const period =
      req.query.period === "daily" || req.query.period === "yearly"
        ? req.query.period
        : "monthly";
    res.json({ items: await repo(req).reportExpenses(orgId(req), period) });
  } catch (err) {
    next(err);
  }
});
