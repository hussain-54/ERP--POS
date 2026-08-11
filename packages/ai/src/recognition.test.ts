import { describe, expect, it } from "vitest";
import {
  mergeSignalsFromHint,
  rankProductMatches,
  resolveRecognitionDecision,
  scoreProductMatch,
} from "./recognition.js";

const catalog = [
  {
    productId: "p1",
    name: "Philips LED Bulb 12W",
    brand: "Philips",
    company: "Signify",
    model: "LED-12",
    size: "A60",
    color: "Warm White",
    watt: 12,
    unitName: "pcs",
    retailPrice: 450,
    stockAvailable: 20,
  },
  {
    productId: "p2",
    name: "Osram LED Bulb 9W",
    brand: "Osram",
    model: "LED-9",
    watt: 9,
    retailPrice: 380,
    stockAvailable: 5,
  },
];

describe("AI recognition matching", () => {
  it("scores brand/model/watt matches highly", () => {
    const ranked = rankProductMatches(
      { brand: "Philips", model: "LED-12", watt: 12, freeText: "bulb" },
      catalog,
    );
    expect(ranked[0]?.product.productId).toBe("p1");
    expect(ranked[0]!.confidence).toBeGreaterThan(0.5);
  });

  it("requires confirmation and never auto-sells or auto-creates", () => {
    const ranked = rankProductMatches(
      { brand: "Philips", model: "LED-12", watt: 12, size: "A60", color: "Warm White" },
      [catalog[0]!],
    );
    const decision = resolveRecognitionDecision(ranked, 0.5);
    expect(decision.status).toBe("exact");
    expect(decision.allowAutoSell).toBe(false);
    expect(decision.allowAutoCreate).toBe(false);
    expect(decision.requiresManualConfirm).toBe(true);
    expect(decision.bestMatch?.product.productId).toBe("p1");
  });

  it("falls back when uncertain", () => {
    const ranked = [
      scoreProductMatch({ freeText: "xyz" }, catalog[0]!),
    ].filter((r) => r.confidence > 0);
    const decision = resolveRecognitionDecision(ranked, 0.9);
    expect(["uncertain", "similar", "none"]).toContain(decision.status);
    expect(decision.fallbacks).toContain("manual_search");
    expect(decision.fallbacks).toContain("new_product");
  });

  it("parses watt from hint text", () => {
    const s = mergeSignalsFromHint({}, "philips 12W warm");
    expect(s.watt).toBe(12);
    expect(s.freeText).toContain("12W");
  });
});
