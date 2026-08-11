import { Router } from "express";
import { CreatePrintJobSchema, OpenCashDrawerSchema } from "@electronic-erp/contracts";
import { HardwareRepository } from "@electronic-erp/db";
import { AuthorizationService } from "@electronic-erp/domain";
import {
  defaultMediaForDocument,
  renderPrintDocument,
  type PrintDocumentJob,
} from "@electronic-erp/hardware";
import { createUserClient } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const hardwareRouter = Router();
hardwareRouter.use(requireAuth);

function repo(req: AuthedRequest): HardwareRepository {
  return new HardwareRepository(createUserClient(req.accessToken!));
}
function authz(req: AuthedRequest): AuthorizationService {
  return new AuthorizationService(req.authz!);
}
function orgId(req: AuthedRequest): string {
  return req.authz!.organizationId;
}

hardwareRouter.post("/print", async (req: AuthedRequest, res, next) => {
  try {
    if (!authz(req).can("printing.print") && !authz(req).can("printing.manage") && !authz(req).can("barcodes.print")) {
      authz(req).assert("printing.print");
    }
    const input = CreatePrintJobSchema.parse({ ...req.body, organizationId: orgId(req) });
    const media = input.media ?? defaultMediaForDocument(input.documentType);
    const doc: PrintDocumentJob = {
      documentType: input.documentType,
      media,
      title: input.title,
      lines: input.lines ?? [],
      meta: input.meta,
      barcodeValue: input.barcodeValue,
      copies: input.copies ?? 1,
    };
    const payload = renderPrintDocument(doc);
    const job = await repo(req).enqueuePrintJob(
      {
        organizationId: orgId(req),
        branchId: input.branchId,
        documentType: input.documentType,
        media,
        payload,
        copies: input.copies,
      },
      req.authz?.userId,
    );
    res.status(201).json({ ...job, preview: payload });
  } catch (err) {
    next(err);
  }
});

hardwareRouter.get("/print-jobs", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("printing.manage");
    res.json({ items: await repo(req).listPrintJobs(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

hardwareRouter.post("/print-jobs/:id/status", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("printing.manage");
    const status = req.body.status as "done" | "failed" | "retrying";
    res.json(await repo(req).markPrintJob(req.params.id!, status, req.body.errorMessage));
  } catch (err) {
    next(err);
  }
});

hardwareRouter.post("/cash-drawer/open", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("cash_drawer.open");
    const input = OpenCashDrawerSchema.parse({ ...req.body, organizationId: orgId(req) });
    res.status(201).json(await repo(req).recordDrawerOpen(input, req.authz?.userId, "connected"));
  } catch (err) {
    next(err);
  }
});

hardwareRouter.get("/events", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("hardware.manage");
    res.json({ items: await repo(req).listHardwareEvents(orgId(req)) });
  } catch (err) {
    next(err);
  }
});

hardwareRouter.get("/capabilities", async (req: AuthedRequest, res, next) => {
  try {
    authz(req).assert("hardware.manage");
    res.json({
      scanners: ["usb_barcode_scanner", "qr_scanner", "camera_scanner", "mobile_camera", "tablet_camera"],
      printers: ["printer_a4", "printer_80mm", "printer_58mm", "printer_barcode", "printer_label"],
      other: ["cash_drawer"],
      documentTypes: [
        "sales_invoice",
        "purchase_invoice",
        "payment_receipt",
        "installment_receipt",
        "quotation",
        "delivery_challan",
        "warranty_card",
        "repair_job_card",
        "barcode_label",
        "stock_report",
      ],
      statuses: [
        "connected",
        "disconnected",
        "unavailable",
        "permission_denied",
        "print_failed",
        "idle",
        "busy",
      ],
    });
  } catch (err) {
    next(err);
  }
});
