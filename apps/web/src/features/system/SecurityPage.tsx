import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { infrastructureApi } from "./infrastructure-api";

export function SecurityPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [minLength, setMinLength] = useState("10");
  const [maxFailed, setMaxFailed] = useState("5");
  const [lockoutMinutes, setLockoutMinutes] = useState("15");
  const [twoFactorEnforced, setTwoFactorEnforced] = useState(false);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [deviceLabel, setDeviceLabel] = useState("POS Terminal 1");

  async function reload() {
    const [s, h, sess, act, dev] = await Promise.all([
      infrastructureApi.getSecuritySettings(),
      infrastructureApi.loginHistory(),
      infrastructureApi.sessions(),
      infrastructureApi.activity(),
      infrastructureApi.devices(),
    ]);
    setSettings(s.item);
    const policy = (s.item.password_policy ?? {}) as Record<string, unknown>;
    setMinLength(String(policy.minLength ?? 10));
    setMaxFailed(String(policy.maxFailedAttempts ?? 5));
    setLockoutMinutes(String(policy.lockoutMinutes ?? 15));
    setTwoFactorEnforced(Boolean(policy.twoFactorEnforced ?? s.item.two_factor_enforced));
    setHistory(h.items);
    setSessions(sess.items);
    setActivity(act.items);
    setDevices(dev.items);
  }

  useEffect(() => {
    void reload().catch((err) =>
      toast.push({
        title: "Security load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Security</h1>
      <p className="text-sm opacity-70">
        Password policy, optional 2FA architecture, sessions, login history, activity logs, device
        management, failed-login protection. Service-role keys never ship to the frontend (anon + JWT
        only).
      </p>

      <Card title="Password policy + encryption">
        <div className="grid gap-2 md:grid-cols-3">
          <Input label="Min length" value={minLength} onChange={(e) => setMinLength(e.target.value)} />
          <Input
            label="Max failed attempts"
            value={maxFailed}
            onChange={(e) => setMaxFailed(e.target.value)}
          />
          <Input
            label="Lockout minutes"
            value={lockoutMinutes}
            onChange={(e) => setLockoutMinutes(e.target.value)}
          />
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={twoFactorEnforced}
            onChange={(e) => setTwoFactorEnforced(e.target.checked)}
          />
          Enforce 2FA (architecture flag — enrollment not fully wired)
        </label>
        <pre className="mt-2 max-h-28 overflow-auto text-xs opacity-70">
          {settings?.encryption ? JSON.stringify(settings.encryption, null, 2) : ""}
        </pre>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void infrastructureApi
                .saveSecuritySettings({
                  passwordPolicy: {
                    minLength: Number(minLength),
                    maxFailedAttempts: Number(maxFailed),
                    lockoutMinutes: Number(lockoutMinutes),
                    twoFactorOptional: !twoFactorEnforced,
                    twoFactorEnforced,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumber: true,
                    requireSymbol: false,
                    sessionTtlHours: 24,
                  },
                  encryptionStrategy: "supabase_at_rest",
                })
                .then(() => reload())
                .then(() => toast.push({ title: "Security settings saved", tone: "success" }))
            }
          >
            Save settings
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void infrastructureApi
                .setup2fa({ enabled: true, method: "totp" })
                .then((r) =>
                  toast.push({
                    title: "2FA flag updated",
                    description: JSON.stringify(r).slice(0, 160),
                    tone: "info",
                  }),
                )
            }
          >
            Enable 2FA architecture
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sessions">
          <ul className="max-h-48 space-y-2 overflow-auto text-sm">
            {sessions.map((s) => (
              <li key={String(s.id)} className="flex justify-between gap-2">
                <span>
                  {String(s.user_id).slice(0, 8)} · {String(s.ip_address ?? "—")}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    void infrastructureApi.revokeSession(String(s.id)).then(() => reload())
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
            {!sessions.length && <li className="opacity-70">No active sessions recorded.</li>}
          </ul>
        </Card>

        <Card title="Security devices">
          <Input
            label="Device label"
            value={deviceLabel}
            onChange={(e) => setDeviceLabel(e.target.value)}
          />
          <Button
            className="mt-2"
            type="button"
            onClick={() =>
              void infrastructureApi
                .registerDevice({
                  deviceLabel,
                  deviceFingerprint: `fp-${Date.now()}`,
                  platform: "web",
                })
                .then(() => reload())
            }
          >
            Register device
          </Button>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
            {devices.map((d) => (
              <li key={String(d.id)} className="flex justify-between gap-2">
                <span>
                  {String(d.device_label)} · {String(d.status)}
                </span>
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() =>
                      void infrastructureApi.setDeviceStatus(String(d.id), "approved").then(() =>
                        reload(),
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      void infrastructureApi.setDeviceStatus(String(d.id), "revoked").then(() =>
                        reload(),
                      )
                    }
                  >
                    Revoke
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Login history">
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {history.map((h) => (
            <li key={String(h.id)}>
              {String(h.created_at)} · {String(h.email)} · {h.success ? "OK" : "FAIL"}{" "}
              {h.failure_reason ? `(${String(h.failure_reason)})` : ""}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Activity logs">
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {activity.map((a) => (
            <li key={String(a.id)}>
              {String(a.created_at)} · {String(a.action)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
