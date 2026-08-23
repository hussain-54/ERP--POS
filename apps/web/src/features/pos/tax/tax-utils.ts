export type TaxWorkspaceMode =
  | "rules"
  | "rates"
  | "inclusive"
  | "exemptions"
  | "ntn"
  | "fbr-invoice"
  | "fbr-submit"
  | "fbr-status"
  | "compliance";

export const TAX_META: Record<TaxWorkspaceMode, { title: string; description: string }> = {
  rules: { title: "Tax rules", description: "Organization tax profile and pricing defaults." },
  rates: { title: "Tax rates", description: "Configured sales tax rates." },
  inclusive: { title: "Tax inclusive / exclusive", description: "How tax is applied to POS prices." },
  exemptions: { title: "Tax exemptions", description: "Exemption handling on tax documents." },
  ntn: { title: "NTN / STRN", description: "Registered taxpayer identifiers." },
  "fbr-invoice": { title: "FBR invoice", description: "Federal Board of Revenue e-invoicing." },
  "fbr-submit": { title: "FBR submission", description: "Submit invoices to FBR IRIS." },
  "fbr-status": { title: "Submission status", description: "Track FBR submission outcomes." },
  compliance: { title: "Compliance reports", description: "Local tax document summary." },
};

export const FBR_UNAVAILABLE =
  "Live FBR integration is not enabled in this build. Tax profile and documents are architecture-ready only.";

export function readProfileField(profile: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = profile[key];
    if (v != null && v !== "") return String(v);
  }
  return "—";
}

export function isFbrLive(profile: Record<string, unknown> | null): boolean {
  if (!profile) return false;
  return Boolean(profile.fbr_integration_enabled ?? profile.fbrIntegrationEnabled);
}
