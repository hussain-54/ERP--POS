import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { partiesApi } from "@/features/customers/parties-api";
import { posHardware } from "./hardware";
import {
  buildPosSettingsCatalog,
  POS_SETTINGS_COLUMNS,
  POS_SETTINGS_HEADING,
  POS_SETTINGS_SECTIONS,
  posSettingStatusLabel,
  posSettingStatusTone,
} from "./pos-settings";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSPageHeader,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const canListMethods = hasPermission("payments.receive");
  const canListTax = hasPermission("tax.view") || hasPermission("tax.manage");
  const catalog = useMemo(() => buildPosSettingsCatalog(), []);
  const [hardware, setHardware] = useState(() => posHardware.listStatuses());
  const [methods, setMethods] = useState<Array<{ code: string; name: string; kind: string; active: boolean }>>(
    [],
  );
  const [taxRates, setTaxRates] = useState<Array<{ code: string; name: string; rate: string; mode: string }>>([]);

  function refreshHardware() {
    setHardware(posHardware.listStatuses());
  }

  useEffect(() => {
    refreshHardware();
  }, []);

  useEffect(() => {
    if (!canListMethods) {
      setMethods([]);
      return;
    }
    void partiesApi
      .listPaymentMethods()
      .then((res) =>
        setMethods(
          res.items.map((row) => ({
            code: String(row.code ?? ""),
            name: String(row.name ?? ""),
            kind: String(row.kind ?? ""),
            active: row.is_active !== false && row.isActive !== false,
          })),
        ),
      )
      .catch(() => setMethods([]));
  }, [canListMethods]);

  useEffect(() => {
    if (!canListTax) {
      setTaxRates([]);
      return;
    }
    void enterpriseApi
      .listTaxRates()
      .then((res) =>
        setTaxRates(
          res.items.map((row) => ({
            code: String(row.code ?? ""),
            name: String(row.name ?? ""),
            rate: `${row.rate_percent ?? row.ratePercent ?? 0}%`,
            mode: String(row.pricing_mode ?? row.pricingMode ?? "exclusive"),
          })),
        ),
      )
      .catch(() => setTaxRates([]));
  }, [canListTax]);

  return (
    <div className="space-y-3">
      <POSPageHeader
        title={POS_SETTINGS_HEADING}
        subtitle="POS-specific configuration that already exists in domain, hardware, or APIs. System Administration keeps security, users, branches, integrations, backup, and company settings."
        actions={
          <POSButton variant="secondary" size="sm" onClick={() => refreshHardware()}>
            Refresh hardware
          </POSButton>
        }
      />

      {POS_SETTINGS_SECTIONS.map((section) => (
        <POSCard key={section} title={section} padding="none">
          <POSTable>
            <POSTableHead>
              <tr>
                {POS_SETTINGS_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {catalog[section].map((row) => (
                <tr key={row.name}>
                  <POSTd className="font-medium">{row.name}</POSTd>
                  <POSTd>{row.value}</POSTd>
                  <POSTd>
                    <POSBadge tone={posSettingStatusTone(row.status)}>
                      {posSettingStatusLabel(row.status)}
                    </POSBadge>
                  </POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>

          {section === "POS Terminal" ? (
            <div className="border-t border-[var(--pos-border)]">
              <p className="px-3 py-2 text-xs font-medium text-[var(--pos-muted)]">Live hardware</p>
              <POSTable>
                <POSTableHead>
                  <tr>
                    <POSTh>Capability</POSTh>
                    <POSTh>Status</POSTh>
                    <POSTh>Detail</POSTh>
                  </tr>
                </POSTableHead>
                <POSTableBody>
                  {hardware.map((item) => (
                    <tr key={item.capability}>
                      <POSTd>{item.capability}</POSTd>
                      <POSTd>
                        <POSBadge
                          tone={item.status === "connected" || item.status === "idle" ? "success" : "neutral"}
                        >
                          {item.status}
                        </POSBadge>
                      </POSTd>
                      <POSTd>{item.message ?? "—"}</POSTd>
                    </tr>
                  ))}
                </POSTableBody>
              </POSTable>
            </div>
          ) : null}

          {section === "Payments" ? (
            <div className="border-t border-[var(--pos-border)]">
              <p className="px-3 py-2 text-xs font-medium text-[var(--pos-muted)]">Live methods</p>
              <POSTable>
                <POSTableHead>
                  <tr>
                    <POSTh>Code</POSTh>
                    <POSTh>Name</POSTh>
                    <POSTh>Kind</POSTh>
                    <POSTh>Status</POSTh>
                  </tr>
                </POSTableHead>
                <POSTableBody>
                  {methods.map((item) => (
                    <tr key={`${item.code}:${item.kind}`}>
                      <POSTd>{item.code || "—"}</POSTd>
                      <POSTd>{item.name || "—"}</POSTd>
                      <POSTd>{item.kind || "—"}</POSTd>
                      <POSTd>
                        <POSBadge tone={item.active ? "success" : "neutral"}>
                          {item.active ? "Active" : "Inactive"}
                        </POSBadge>
                      </POSTd>
                    </tr>
                  ))}
                </POSTableBody>
              </POSTable>
            </div>
          ) : null}

          {section === "Tax" ? (
            <div className="border-t border-[var(--pos-border)]">
              <p className="px-3 py-2 text-xs font-medium text-[var(--pos-muted)]">Live rates</p>
              <POSTable>
                <POSTableHead>
                  <tr>
                    <POSTh>Code</POSTh>
                    <POSTh>Name</POSTh>
                    <POSTh>Rate</POSTh>
                    <POSTh>Pricing</POSTh>
                  </tr>
                </POSTableHead>
                <POSTableBody>
                  {taxRates.map((item) => (
                    <tr key={item.code || item.name}>
                      <POSTd>{item.code || "—"}</POSTd>
                      <POSTd>{item.name || "—"}</POSTd>
                      <POSTd>{item.rate}</POSTd>
                      <POSTd>{item.mode}</POSTd>
                    </tr>
                  ))}
                </POSTableBody>
              </POSTable>
            </div>
          ) : null}

          {section === "Discounts" ? (
            <p className="border-t border-[var(--pos-border)] px-3 py-2 text-xs text-[var(--pos-muted)]">
              Caps are enforced in discount-policy.ts. Manage approvals on{" "}
              <Link className="text-[var(--pos-primary)] underline" to="/discounts">
                Discounts
              </Link>
              .
            </p>
          ) : null}
        </POSCard>
      ))}
    </div>
  );
}
