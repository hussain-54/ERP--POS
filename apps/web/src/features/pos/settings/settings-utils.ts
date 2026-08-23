export type SettingsWorkspaceMode =
  | "general"
  | "terminal"
  | "receipt"
  | "invoice"
  | "payments"
  | "tax"
  | "discounts"
  | "returns"
  | "credit"
  | "shifts"
  | "numbering"
  | "hardware"
  | "offline";

export const SETTINGS_META: Record<SettingsWorkspaceMode, { title: string; description: string }> = {
  general: { title: "General", description: "Branch context and POS workspace defaults." },
  terminal: { title: "Terminal", description: "Terminal behaviour and checkout defaults." },
  receipt: { title: "Receipt", description: "Receipt header, footer, and print defaults." },
  invoice: { title: "Invoice", description: "Invoice layout and numbering display." },
  payments: { title: "Payment methods", description: "Tenders enabled for this organization." },
  tax: { title: "Tax", description: "POS tax defaults from the organization profile." },
  discounts: { title: "Discount rules", description: "Discount limits and approval thresholds." },
  returns: { title: "Return rules", description: "Return window and refund policy." },
  credit: { title: "Credit rules", description: "Udhar / credit sale limits." },
  shifts: { title: "Shift rules", description: "Shift open/close requirements." },
  numbering: { title: "Numbering", description: "Document and invoice numbering sequences." },
  hardware: { title: "Hardware", description: "Default printers and peripherals." },
  offline: { title: "Offline settings", description: "Offline POS behaviour when disconnected." },
};

export const SETTINGS_PLANNED: Partial<Record<SettingsWorkspaceMode, string>> = {
  terminal: "Dedicated terminal settings API is not available. Terminal behaviour uses server POS defaults.",
  receipt: "Receipt template designer is not implemented. Reprint uses the sale invoice payload.",
  invoice: "Invoice template settings are not implemented. Use Invoices & Receipts for document output.",
  discounts: "Discount rule limits are enforced server-side via permissions — no POS settings API yet.",
  returns: "Return policy is enforced by the returns API and reason codes — no separate rules editor.",
  credit: "Credit limits live on the customer record — no POS-wide credit rules API.",
  shifts: "Shift rules are enforced when opening/closing shifts — no dedicated settings endpoint.",
  numbering: "Document numbering sequences are not editable from POS settings in this build.",
  offline: "Offline POS and SQLite sync are not implemented. This build requires an online connection.",
};
