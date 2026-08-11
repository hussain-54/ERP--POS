import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { commerceApi } from "./commerce-api";

export function LoyaltyPage() {
  const toast = useToast();
  const [customerId, setCustomerId] = useState("");
  const [account, setAccount] = useState<Record<string, unknown> | null>(null);
  const [ledger, setLedger] = useState<Array<Record<string, unknown>>>([]);
  const [offers, setOffers] = useState<Array<Record<string, unknown>>>([]);
  const [purchaseAmount, setPurchaseAmount] = useState("1000");
  const [redeemPoints, setRedeemPoints] = useState("100");

  async function reloadOffers() {
    const o = await commerceApi.listOffers();
    setOffers(o.items);
  }

  useEffect(() => {
    void reloadOffers().catch(() => undefined);
  }, []);

  async function loadCustomer() {
    const [a, l] = await Promise.all([
      commerceApi.account(customerId),
      commerceApi.ledger(customerId),
    ]);
    setAccount(a.item);
    setLedger(l.items);
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Loyalty</h1>
      <p className="text-sm opacity-70">
        Purchase points, rewards, Silver / Gold / Platinum membership, offers, expiry, and redemption
        history.
      </p>

      <Card title="Tiers & offers">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void commerceApi
                .seedTiers()
                .then(() => toast.push({ title: "Silver/Gold/Platinum seeded", tone: "success" }))
            }
          >
            Seed loyalty tiers
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void commerceApi
                .createOffer({
                  code: `OFF-${Date.now().toString().slice(-4)}`,
                  name: "100 pts → 5% off",
                  pointsCost: 100,
                  discountPercent: 5,
                  tierCode: "silver",
                })
                .then(() => reloadOffers())
                .then(() => toast.push({ title: "Offer created", tone: "success" }))
            }
          >
            Create sample offer
          </Button>
        </div>
        <ul className="mt-3 text-sm">
          {offers.map((o) => (
            <li key={String(o.id)}>
              {String(o.code)} — {String(o.points_cost)} pts
              {o.tier_code ? ` (${String(o.tier_code)})` : ""}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Customer account">
        <Input
          label="Customer id"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <Button className="mt-2" type="button" onClick={() => void loadCustomer()}>
          Load account
        </Button>
        {account && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div>Tier: {String(account.tier_code)}</div>
            <div>Balance: {String(account.points_balance)}</div>
            <div>Lifetime: {String(account.lifetime_points)}</div>
          </div>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <Input
            label="Purchase amount (earn)"
            value={purchaseAmount}
            onChange={(e) => setPurchaseAmount(e.target.value)}
          />
          <Input
            label="Points to redeem"
            value={redeemPoints}
            onChange={(e) => setRedeemPoints(e.target.value)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void commerceApi
                .earn({ customerId, purchaseAmount: Number(purchaseAmount) })
                .then(() => loadCustomer())
                .then(() => toast.push({ title: "Points earned", tone: "success" }))
                .catch((err) =>
                  toast.push({
                    title: "Earn failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Earn from purchase
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void commerceApi
                .redeem({ customerId, points: Number(redeemPoints) })
                .then(() => loadCustomer())
                .then(() => toast.push({ title: "Redeemed", tone: "success" }))
                .catch((err) =>
                  toast.push({
                    title: "Redeem failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Redeem points
          </Button>
        </div>
        <pre className="mt-3 max-h-56 overflow-auto text-xs">
          {ledger.length ? JSON.stringify(ledger, null, 2) : "Redemption / earn history appears here."}
        </pre>
      </Card>
    </div>
  );
}
