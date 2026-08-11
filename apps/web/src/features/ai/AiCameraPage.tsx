import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { aiApi } from "./ai-api";

type Decision = Awaited<ReturnType<typeof aiApi.recognize>>["decision"];

export function AiCameraPage() {
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState("");
  const [hintText, setHintText] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [watt, setWatt] = useState("");
  const [threshold, setThreshold] = useState("0.78");
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [eventId, setEventId] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  async function onFile(file: File | null) {
    if (!file) {
      setImageBase64(undefined);
      return;
    }
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    setImageBase64(btoa(binary));
  }

  async function recognize() {
    try {
      const res = await aiApi.recognize({
        warehouseId: warehouseId || undefined,
        hintText: hintText || undefined,
        imageBase64,
        imageMimeType: imageBase64 ? "image/jpeg" : undefined,
        confidenceThreshold: Number(threshold),
        source: "ai_camera",
        signals: {
          brand: brand || undefined,
          model: model || undefined,
          size: size || undefined,
          color: color || undefined,
          watt: watt ? Number(watt) : undefined,
          freeText: hintText || undefined,
        },
      });
      setEventId(res.recognitionEventId);
      setDecision(res.decision);
      toast.push({
        title: `Recognition: ${res.decision.status}`,
        description: `Top confidence ${res.decision.topConfidence.toFixed(2)} (threshold ${res.decision.confidenceThreshold})`,
        tone: res.decision.status === "exact" ? "success" : "info",
      });
    } catch (err) {
      toast.push({
        title: "Recognition failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function confirm(
    action: "confirm_match" | "manual_select" | "manual_search" | "new_product",
    productId?: string,
  ) {
    if (!eventId) return;
    try {
      await aiApi.confirm({ recognitionEventId: eventId, productId, action });
      toast.push({
        title: action === "new_product" ? "New product path (manual)" : "Confirmed for POS",
        description:
          action === "new_product"
            ? "AI did not create a product. Open catalog to add manually."
            : "Open POS and search/add the confirmed product.",
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Confirm failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">AI Camera Recognition</h1>
      <p className="text-sm opacity-70">
        Camera → image → AI recognition (service layer) → catalog match → price + stock → POS.
        Uncertain matches never auto-sell; products are never auto-created.
      </p>

      <Card title="Capture / signals">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            label="Warehouse id (stock)"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
          <Input
            label="Confidence threshold"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <Input label="Hint / OCR text" value={hintText} onChange={(e) => setHintText(e.target.value)} />
          <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <Input label="Model / variant" value={model} onChange={(e) => setModel(e.target.value)} />
          <Input label="Size" value={size} onChange={(e) => setSize(e.target.value)} />
          <Input label="Color" value={color} onChange={(e) => setColor(e.target.value)} />
          <Input label="Watt" value={watt} onChange={(e) => setWatt(e.target.value)} />
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="opacity-70">Image (optional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <Button className="mt-3" type="button" onClick={() => void recognize()}>
          Run AI recognition
        </Button>
      </Card>

      {decision && (
        <Card title={`Result: ${decision.status}`}>
          <ul className="mb-3 list-disc pl-5 text-sm opacity-80">
            {decision.explanations.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="text-xs opacity-60">
            allowAutoSell={String(decision.allowAutoSell)} · allowAutoCreate=
            {String(decision.allowAutoCreate)} · requiresManualConfirm=
            {String(decision.requiresManualConfirm)}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {decision.candidates.map((c) => (
              <li
                key={c.product.productId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--erp-border)] px-3 py-2"
              >
                <div>
                  <div className="font-medium">{c.product.name}</div>
                  <div className="opacity-70">
                    {[c.product.brand, c.product.model, c.product.size, c.product.color, c.product.watt]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="tabular-nums">
                    conf {c.confidence.toFixed(2)} · price {c.product.retailPrice ?? "—"} · stock{" "}
                    {c.product.stockAvailable ?? "—"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => void confirm("manual_select", c.product.productId)}
                  >
                    Select
                  </Button>
                  <Link
                    className="inline-flex h-9 items-center rounded-xl border px-3 text-sm"
                    to={`/pos?q=${encodeURIComponent(c.product.name)}`}
                  >
                    Open POS
                  </Link>
                </div>
              </li>
            ))}
            {!decision.candidates.length && (
              <li className="opacity-70">No candidates — use manual search or new product.</li>
            )}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {decision.bestMatch && (
              <Button
                type="button"
                onClick={() =>
                  void confirm("confirm_match", decision.bestMatch!.product.productId)
                }
              >
                Confirm best match
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => void confirm("manual_search")}
            >
              Manual search
            </Button>
            <Button type="button" variant="secondary" onClick={() => void confirm("new_product")}>
              New product (manual)
            </Button>
            <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/pos">
              Go to POS
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-xl border px-4 text-sm"
              to="/products"
            >
              Catalog
            </Link>
          </div>
          <pre className="mt-3 max-h-40 overflow-auto text-xs opacity-70">
            {JSON.stringify(decision.trace, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
