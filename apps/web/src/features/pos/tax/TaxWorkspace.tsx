import { useCallback, useEffect, useState } from "react";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";
import { PosReportMetrics, PosReportTable } from "../reports/report-view";
import { docAmount, docField } from "../invoices/invoice-utils";
import { money } from "../format";
import { FBR_UNAVAILABLE, isFbrLive, readProfileField, TAX_META, type TaxWorkspaceMode } from "./tax-utils";

function FbrUnavailablePanel({ title }: { title: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">FBR not live</p>
        <p className="mt-1 text-amber-800">{FBR_UNAVAILABLE}</p>
      </div>
      <PosComingSoonPanel title={title} reason={FBR_UNAVAILABLE} />
    </div>
  );
}

export function TaxWorkspace({ mode }: { mode: TaxWorkspaceMode }) {
  const meta = TAX_META[mode];
  const { hasPermission } = useAuth();
  const { push } = useToast();
  const canManage = hasPermission("tax.manage");

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [rates, setRates] = useState<Array<Record<string, unknown>>>([]);
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const [ntn, setNtn] = useState("");
  const [strn, setStrn] = useState("");
  const [legalName, setLegalName] = useState("");
  const [province, setProvince] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "rates") {
        const r = await enterpriseApi.listTaxRates();
        setRates(r.items ?? []);
        return;
      }
      if (mode === "exemptions") {
        const d = await enterpriseApi.listTaxDocuments();
        setDocuments(d.items ?? []);
        return;
      }
      if (mode === "compliance") {
        const rep = await enterpriseApi.taxReport();
        setReport(rep);
        return;
      }
      const p = await enterpriseApi.getTaxProfile();
      const item = p.item ?? {};
      setProfile(item);
      setNtn(readProfileField(item, "ntn"));
      setStrn(readProfileField(item, "strn"));
      setLegalName(readProfileField(item, "legal_name", "legalName"));
      setProvince(readProfileField(item, "tax_province", "taxProvince"));
      setNotes(readProfileField(item, "notes"));
    } catch (err) {
      push({
        title: "Tax data failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [mode, push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile() {
    if (!canManage) {
      push({ title: "Read only", description: "You need tax.manage to edit the profile.", tone: "danger" });
      return;
    }
    try {
      await enterpriseApi.saveTaxProfile({
        ntn: ntn || undefined,
        strn: strn || undefined,
        legalName: legalName || undefined,
        taxProvince: province || undefined,
        notes: notes || undefined,
        fbrIntegrationEnabled: false,
      });
      push({ title: "Tax profile saved", tone: "success" });
      void load();
    } catch (err) {
      push({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  if (mode === "fbr-invoice" || mode === "fbr-submit" || mode === "fbr-status") {
    return (
      <PosSubPageShell moduleNumber="12" moduleLabel="Tax & Compliance" title={meta.title} description={meta.description}>
        <FbrUnavailablePanel title={meta.title} />
      </PosSubPageShell>
    );
  }

  return (
    <PosSubPageShell moduleNumber="12" moduleLabel="Tax & Compliance" title={meta.title} description={meta.description}>
      {loading ? <p className="text-sm text-slate-400">Loading tax data…</p> : null}

      {(mode === "rules" || mode === "ntn" || mode === "inclusive") && (
        <div className="space-y-3">
          {!isFbrLive(profile) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {FBR_UNAVAILABLE}
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Legal name</span>
                <input
                  value={legalName === "—" ? "" : legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">Tax province</span>
                <input
                  value={province === "—" ? "" : province}
                  onChange={(e) => setProvince(e.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">NTN</span>
                <input
                  value={ntn === "—" ? "" : ntn}
                  onChange={(e) => setNtn(e.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-700">STRN</span>
                <input
                  value={strn === "—" ? "" : strn}
                  onChange={(e) => setStrn(e.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
            {mode === "inclusive" ? (
              <p className="mt-3 text-sm text-slate-600">
                Default pricing mode on new tax documents is <strong>exclusive</strong> unless overridden per document.
                Inclusive/exclusive is stored on each tax document — not a global POS toggle yet.
              </p>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => void saveProfile()}
                className="mt-3 rounded-xl bg-[var(--pos-primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                Save profile
              </button>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Read-only — requires tax.manage to edit.</p>
            )}
          </div>
        </div>
      )}

      {mode === "rates" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Rate %</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={String(r.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{docField(r, "name")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{docField(r, "rate_percent", "ratePercent")}</td>
                  <td className="px-3 py-2">{docField(r, "pricing_mode", "pricingMode")}</td>
                  <td className="px-3 py-2">{String(r.is_active ?? r.isActive ?? true)}</td>
                </tr>
              ))}
              {!rates.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    No tax rates configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {mode === "exemptions" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p>
            Exemptions are captured on individual tax documents (buyer NTN/STRN and notes). There is no separate exemption
            rules engine in this build.
          </p>
          <p className="mt-2">Recent documents with buyer identifiers:</p>
          <ul className="mt-2 space-y-1">
            {documents
              .filter((d) => d.buyer_ntn || d.buyerNtn || d.buyer_strn || d.buyerStrn)
              .slice(0, 10)
              .map((d) => (
                <li key={String(d.id)} className="rounded-lg bg-slate-50 px-2 py-1">
                  {docField(d, "document_type", "documentType")} · NTN {docField(d, "buyer_ntn", "buyerNtn")} · STRN{" "}
                  {docField(d, "buyer_strn", "buyerStrn")}
                </li>
              ))}
            {!documents.some((d) => d.buyer_ntn || d.buyerNtn) ? (
              <li className="text-slate-400">No exemption documents recorded yet.</li>
            ) : null}
          </ul>
        </div>
      )}

      {mode === "compliance" && report ? (
        <div className="space-y-3">
          <PosReportMetrics
            items={[
              { label: "Documents", value: String(report.documentCount ?? 0) },
              { label: "Taxable total", value: money(Number(report.taxableTotal ?? 0)) },
              { label: "Tax total", value: money(Number(report.taxTotal ?? 0)) },
              { label: "FBR", value: "Not live", hint: typeof report.note === "string" ? report.note : FBR_UNAVAILABLE },
            ]}
          />
          <PosReportTable
            rows={(Array.isArray(report.recent) ? report.recent : []).map((doc) => {
              const row = doc as Record<string, unknown>;
              return {
                key: String(row.id ?? row.document_type),
                label: String(row.document_type ?? row.documentType ?? "document"),
                amount: docAmount(row, "tax_amount", "taxAmount"),
              };
            })}
            amountLabel="Tax"
          />
        </div>
      ) : null}
    </PosSubPageShell>
  );
}
