import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { infrastructureApi } from "./infrastructure-api";

export function IntegrationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [apiBasePath, setApiBasePath] = useState("/api/v1");
  const [name, setName] = useState("Mobile app");
  const [audience, setAudience] = useState("mobile");
  const [onceKey, setOnceKey] = useState<string | null>(null);

  async function reload() {
    const r = await infrastructureApi.listIntegrations();
    setItems(r.items);
    setAudiences(r.audiences);
    setApiBasePath(r.apiBasePath);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">API integration clients</h1>
      <p className="text-sm opacity-70">
        Versioned APIs under <code>{apiBasePath}</code> for mobile, website, payment gateways, banks,
        courier, WhatsApp, SMS, accounting, e-commerce, and custom consumers. API keys are shown once
        and never stored in frontend bundles.
      </p>

      <Card title="Create client">
        <div className="grid gap-2 md:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Audience</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              {(audiences.length
                ? audiences
                : [
                    "mobile",
                    "website",
                    "payment_gateway",
                    "bank",
                    "courier",
                    "whatsapp",
                    "sms",
                    "accounting",
                    "ecommerce",
                    "custom",
                  ]
              ).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button
          className="mt-3"
          type="button"
          onClick={() =>
            void infrastructureApi
              .createIntegration({
                name,
                audience,
                scopes: ["read", "write"],
              })
              .then((r) => {
                setOnceKey(r.apiKeyOnce);
                toast.push({ title: "Client created — copy API key now", tone: "success" });
                return reload();
              })
          }
        >
          Create API client
        </Button>
        {onceKey ? (
          <pre className="mt-3 overflow-auto rounded border border-[var(--erp-border)] p-2 text-xs">
            {onceKey}
          </pre>
        ) : null}
      </Card>

      <Card title="Clients">
        <ul className="space-y-2 text-sm">
          {items.map((c) => (
            <li
              key={String(c.id)}
              className="flex items-center justify-between gap-2 rounded border border-[var(--erp-border)] px-3 py-2"
            >
              <div>
                <div className="font-medium">
                  {String(c.name)} · {String(c.audience)}
                </div>
                <div className="opacity-70">
                  prefix {String(c.key_prefix)} · active={String(c.is_active)}
                </div>
              </div>
              {Boolean(c.is_active) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    void infrastructureApi.revokeIntegration(String(c.id)).then(() => reload())
                  }
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
          {!items.length && <li className="opacity-70">No integration clients yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
