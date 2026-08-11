/**
 * POS toast API reuses the shared ERP ToastProvider — no second toast stack.
 * Prefer usePOSToast in new POS UI; existing screens may keep useToast.
 */
export { ToastProvider as POSToastProvider, useToast as usePOSToast } from "@electronic-erp/ui";

export type POSToastTone = "success" | "danger" | "info";
