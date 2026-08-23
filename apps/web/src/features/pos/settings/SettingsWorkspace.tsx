import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { partiesApi } from "@/features/customers/parties-api";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";
import { readProfileField } from "../tax/tax-utils";
import { SETTINGS_META, SETTINGS_PLANNED, type SettingsWorkspaceMode } from "./settings-utils";

export function SettingsWorkspace({ mode }: { mode: SettingsWorkspaceMode }) {
  const meta = SETTINGS_META[mode];
  const planned = SETTINGS_PLANNED[mode];
  const { branchId, user, organizationId } = useAuth();
  const { push } = useToast();
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== "payments" && mode !== "tax" && mode !== "general") return;
    setLoading(true);
    void Promise.all([
      mode === "payments" ? partiesApi.listPaymentMethods().then((r) => setPayments(r.items)) : Promise.resolve(),
      mode === "tax" || mode === "general"
        ? enterpriseApi.getTaxProfile().then((r) => setProfile(r.item ?? null))
        : Promise.resolve(),
    ])
      .catch((err) =>
        push({
          title: "Settings load failed",
          description: err instanceof Error ? err.message : "Error",
          tone: "danger",
        }),
      )
      .finally(() => setLoading(false));
  }, [mode, push]);

  if (planned && mode !== "general" && mode !== "payments" && mode !== "tax") {
    return (
      <PosSubPageShell moduleNumber="15" moduleLabel="POS Settings" title={meta.title} description={meta.description}>
        {mode === "offline" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Offline POS — not enabled</p>
              <p className="mt-1">{planned}</p>
            </div>
            <PosComingSoonPanel title="Offline settings" reason={planned} />
          </div>
        ) : (
          <PosComingSoonPanel title={meta.title} reason={planned} />
        )}
      </PosSubPageShell>
    );
  }

  return (
    <PosSubPageShell moduleNumber="15" moduleLabel="POS Settings" title={meta.title} description={meta.description}>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}

      {mode === "general" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">Organization</p>
            <p className="mt-1 font-semibold text-slate-900">{organizationId ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">Branch</p>
            <p className="mt-1 font-semibold text-slate-900">{branchId ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">Signed in as</p>
            <p className="mt-1 font-semibold text-slate-900">{user?.email ?? user?.id ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-400">Tax profile</p>
            <p className="mt-1 text-sm text-slate-700">{readProfileField(profile ?? {}, "legal_name", "legalName")}</p>
          </div>
        </div>
      )}

      {mode === "payments" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Kind</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((m) => (
                <tr key={String(m.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{String(m.name ?? "—")}</td>
                  <td className="px-3 py-2">{String(m.code ?? "—")}</td>
                  <td className="px-3 py-2">{String(m.is_active ?? m.isActive ?? true)}</td>
                  <td className="px-3 py-2">{String(m.kind ?? m.method_kind ?? "—")}</td>
                </tr>
              ))}
              {!payments.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    No payment methods returned.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Card and wallet tenders are record-only — no live PSP integration.
          </p>
        </div>
      )}

      {mode === "tax" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-[10px] uppercase text-slate-400">Legal name</dt>
              <dd className="font-semibold">{readProfileField(profile ?? {}, "legal_name", "legalName")}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-400">NTN</dt>
              <dd className="font-semibold">{readProfileField(profile ?? {}, "ntn")}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-400">STRN</dt>
              <dd className="font-semibold">{readProfileField(profile ?? {}, "strn")}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-400">Province</dt>
              <dd className="font-semibold">{readProfileField(profile ?? {}, "tax_province", "taxProvince")}</dd>
            </div>
          </dl>
          <Link to="/pos/tax" className="mt-3 inline-flex text-sm font-semibold text-[var(--pos-primary)]">
            Open Tax & Compliance →
          </Link>
        </div>
      )}

      {mode === "hardware" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p>Configure printers, scanners, and drawer on the Devices screen for this workstation.</p>
          <Link to="/pos/devices" className="mt-3 inline-flex font-semibold text-[var(--pos-primary)]">
            Open Devices & Terminal →
          </Link>
        </div>
      )}
    </PosSubPageShell>
  );
}
