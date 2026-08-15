import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { commerceApi } from "./commerce-api";

export function CrmPage() {
  const toast = useToast();
  const [segments, setSegments] = useState<Array<Record<string, unknown>>>([]);
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [code, setCode] = useState("VIP");
  const [name, setName] = useState("VIP wholesale");
  const [customerId, setCustomerId] = useState("");
  const [profile, setProfile] = useState<unknown>(null);
  const [campCode, setCampCode] = useState("FEST-01");
  const [campName, setCampName] = useState("Festival offer");
  const [channel, setChannel] = useState("whatsapp");
  const [message, setMessage] = useState("Special festival discount for you!");
  const [segmentId, setSegmentId] = useState("");

  async function reload() {
    const [s, c] = await Promise.all([commerceApi.listSegments(), commerceApi.listCampaigns()]);
    setSegments(s.items);
    setCampaigns(c.items);
  }

  useEffect(() => {
    void reload().catch((err) =>
      toast.push({
        title: "CRM load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">CRM & marketing</h1>
      <p className="text-sm opacity-70">
        Segmentation, purchase history, buying patterns, location, customer type, and campaigns
        (SMS / WhatsApp / festival / discount / new product / customer-specific).
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Segments">
          <div className="grid gap-2">
            <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              type="button"
              onClick={() =>
                void commerceApi
                  .createSegment({
                    code,
                    name,
                    ruleJson: { customerTypes: ["wholesale", "dealer"] },
                  })
                  .then(() => reload())
                  .then(() => toast.push({ title: "Segment created", tone: "success" }))
                  .catch((err) =>
                    toast.push({
                      title: "Failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Create segment
            </Button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {segments.map((s) => (
              <li key={String(s.id)} className="flex items-center justify-between gap-2">
                <span>
                  {String(s.code)} — {String(s.name)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void commerceApi
                      .refreshSegment(String(s.id))
                      .then((r) =>
                        toast.push({
                          title: "Members refreshed",
                          description: `Count: ${String((r as { memberCount?: number }).memberCount ?? "")}`,
                          tone: "success",
                        }),
                      )
                  }
                >
                  Refresh members
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Customer CRM profile">
          <Input
            label="Customer id"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
          <Button
            className="mt-2"
            type="button"
            onClick={() =>
              void commerceApi
                .customerProfile(customerId)
                .then(setProfile)
                .catch((err) =>
                  toast.push({
                    title: "Profile failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Load profile
          </Button>
          <pre className="mt-3 max-h-64 overflow-auto text-xs">
            {profile ? JSON.stringify(profile, null, 2) : "Load a customer to see history & patterns."}
          </pre>
        </Card>
      </div>

      <Card title="Campaigns">
        <div className="grid gap-2 md:grid-cols-2">
          <Input label="Code" value={campCode} onChange={(e) => setCampCode(e.target.value)} />
          <Input label="Name" value={campName} onChange={(e) => setCampName(e.target.value)} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Channel</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {["sms", "whatsapp", "festival", "discount", "new_product", "customer_specific"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
          </label>
          <Input
            label="Segment id"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
          />
          <Input
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="md:col-span-2"
          />
        </div>
        <Button
          className="mt-3"
          type="button"
          onClick={() =>
            void commerceApi
              .createCampaign({
                code: campCode,
                name: campName,
                channel,
                segmentId: segmentId || undefined,
                customerId: channel === "customer_specific" ? customerId || undefined : undefined,
                messageTemplate: message,
                offerPercent: 10,
              })
              .then(() => reload())
              .then(() => toast.push({ title: "Campaign created", tone: "success" }))
              .catch((err) =>
                toast.push({
                  title: "Campaign failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              )
          }
        >
          Create campaign
        </Button>
        <ul className="mt-3 space-y-2 text-sm">
          {campaigns.map((c) => (
            <li key={String(c.id)} className="flex justify-between gap-2">
              <span>
                {String(c.code)} ({String(c.channel)}) — {String(c.status)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void commerceApi
                    .runCampaign(String(c.id))
                    .then((r) =>
                      toast.push({
                        title: "Campaign queued",
                        description: JSON.stringify(r),
                        tone: "success",
                      }),
                    )
                }
              >
                Run / queue sends
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
