/** Isolated AI camera recognition — matching only; never auto-creates products. */

export interface ProductSignals {
  brand?: string;
  company?: string;
  model?: string;
  variant?: string;
  size?: string;
  color?: string;
  watt?: number;
  specifications?: string;
  unit?: string;
  freeText?: string;
}

export interface CatalogProductCandidate {
  productId: string;
  name: string;
  sku?: string | null;
  brand?: string | null;
  company?: string | null;
  model?: string | null;
  size?: string | null;
  color?: string | null;
  watt?: number | null;
  unitName?: string | null;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  stockAvailable?: number | null;
  specificationsText?: string | null;
}

export type RecognitionStatus = "exact" | "similar" | "uncertain" | "none";

export interface RankedMatch {
  product: CatalogProductCandidate;
  confidence: number;
  matchedFields: string[];
  explanation: string;
}

export interface RecognitionDecision {
  status: RecognitionStatus;
  confidenceThreshold: number;
  topConfidence: number;
  /** Set only when status === "exact" — still requires UI confirm before sell. */
  bestMatch: RankedMatch | null;
  candidates: RankedMatch[];
  similar: RankedMatch[];
  allowAutoSell: false;
  allowAutoCreate: false;
  requiresManualConfirm: boolean;
  fallbacks: Array<"similar_products" | "manual_selection" | "manual_search" | "new_product">;
  explanations: string[];
  trace: Array<{ step: string; detail: string }>;
}

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function includesLoose(hay: string, needle: string): boolean {
  if (!needle) return false;
  return hay.includes(needle) || needle.includes(hay);
}

function fieldScore(
  signal: string | undefined,
  value: string | null | undefined,
  weight: number,
  field: string,
  matched: string[],
): number {
  const a = norm(signal);
  const b = norm(value);
  if (!a || !b) return 0;
  if (a === b) {
    matched.push(field);
    return weight;
  }
  if (includesLoose(b, a)) {
    matched.push(field);
    return weight * 0.75;
  }
  return 0;
}

/** Score one catalog row against extracted camera/OCR signals (0–1). */
export function scoreProductMatch(
  signals: ProductSignals,
  product: CatalogProductCandidate,
): RankedMatch {
  const matched: string[] = [];
  let score = 0;
  let weightSum = 0;

  const parts: Array<[keyof ProductSignals | "name", number]> = [
    ["brand", 0.18],
    ["company", 0.12],
    ["model", 0.18],
    ["variant", 0.08],
    ["size", 0.1],
    ["color", 0.08],
    ["unit", 0.06],
  ];

  for (const [key, w] of parts) {
    weightSum += w;
    if (key === "variant") {
      score += fieldScore(signals.variant, product.model, w, "variant/model", matched);
      continue;
    }
    if (key === "unit") {
      score += fieldScore(signals.unit, product.unitName, w, "unit", matched);
      continue;
    }
    const sig = signals[key as keyof ProductSignals];
    const val =
      key === "brand"
        ? product.brand
        : key === "company"
          ? product.company
          : key === "model"
            ? product.model
            : key === "size"
              ? product.size
              : key === "color"
                ? product.color
                : undefined;
    score += fieldScore(typeof sig === "string" ? sig : undefined, val, w, key, matched);
  }

  weightSum += 0.1;
  if (signals.watt != null && product.watt != null) {
    const diff = Math.abs(signals.watt - product.watt);
    if (diff === 0) {
      score += 0.1;
      matched.push("watt");
    } else if (diff / Math.max(signals.watt, 1) < 0.05) {
      score += 0.06;
      matched.push("watt~");
    }
  }

  weightSum += 0.1;
  const blob = norm(
    [product.name, product.sku, product.specificationsText, product.brand, product.model].join(" "),
  );
  const free = norm(signals.freeText ?? signals.specifications ?? "");
  if (free) {
    const tokens = free.split(" ").filter((t) => t.length > 2);
    const hits = tokens.filter((t) => blob.includes(t)).length;
    if (tokens.length) {
      const ratio = hits / tokens.length;
      score += 0.1 * ratio;
      if (ratio >= 0.5) matched.push("freeText");
    }
  }

  const confidence = Math.min(1, Math.round((score / Math.max(weightSum, 0.01)) * 1000) / 1000);
  return {
    product,
    confidence,
    matchedFields: matched,
    explanation: matched.length
      ? `Matched ${matched.join(", ")} (confidence ${confidence.toFixed(2)})`
      : `Weak lexical overlap (confidence ${confidence.toFixed(2)})`,
  };
}

export function rankProductMatches(
  signals: ProductSignals,
  products: CatalogProductCandidate[],
  limit = 12,
): RankedMatch[] {
  return products
    .map((p) => scoreProductMatch(signals, p))
    .filter((r) => r.confidence > 0.05)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Gate recognition: never auto-sell uncertain matches; never auto-create products.
 */
export function resolveRecognitionDecision(
  ranked: RankedMatch[],
  confidenceThreshold = 0.78,
): RecognitionDecision {
  const trace: Array<{ step: string; detail: string }> = [
    { step: "rank", detail: `Scored ${ranked.length} catalog candidates` },
    { step: "threshold", detail: `Confidence threshold=${confidenceThreshold}` },
  ];

  const fallbacks: RecognitionDecision["fallbacks"] = [
    "similar_products",
    "manual_selection",
    "manual_search",
    "new_product",
  ];

  if (!ranked.length) {
    return {
      status: "none",
      confidenceThreshold,
      topConfidence: 0,
      bestMatch: null,
      candidates: [],
      similar: [],
      allowAutoSell: false,
      allowAutoCreate: false,
      requiresManualConfirm: true,
      fallbacks,
      explanations: [
        "No catalog match from signals. Use manual search or create a new product (manual).",
      ],
      trace: [...trace, { step: "result", detail: "none" }],
    };
  }

  const top = ranked[0]!;
  const second = ranked[1];
  const clearWinner =
    top.confidence >= confidenceThreshold &&
    (!second || top.confidence - second.confidence >= 0.08);

  if (clearWinner) {
    trace.push({
      step: "result",
      detail: `exact candidate ${top.product.productId} conf=${top.confidence}`,
    });
    return {
      status: "exact",
      confidenceThreshold,
      topConfidence: top.confidence,
      bestMatch: top,
      candidates: ranked,
      similar: ranked.slice(1, 6),
      allowAutoSell: false,
      allowAutoCreate: false,
      requiresManualConfirm: true,
      fallbacks: ["manual_selection", "manual_search", "new_product"],
      explanations: [
        top.explanation,
        "Exact match requires operator confirmation before POS sell — AI will not auto-sell.",
        "AI will not auto-create a product.",
      ],
      trace,
    };
  }

  if (top.confidence >= confidenceThreshold * 0.7) {
    return {
      status: "similar",
      confidenceThreshold,
      topConfidence: top.confidence,
      bestMatch: null,
      candidates: ranked,
      similar: ranked.slice(0, 8),
      allowAutoSell: false,
      allowAutoCreate: false,
      requiresManualConfirm: true,
      fallbacks,
      explanations: [
        `Top confidence ${top.confidence.toFixed(2)} below clear-winner rule or tied.`,
        "Showing similar products for manual selection.",
        "AI will not auto-sell or auto-create.",
      ],
      trace: [...trace, { step: "result", detail: "similar" }],
    };
  }

  return {
    status: "uncertain",
    confidenceThreshold,
    topConfidence: top.confidence,
    bestMatch: null,
    candidates: ranked.slice(0, 5),
    similar: ranked.slice(0, 5),
    allowAutoSell: false,
    allowAutoCreate: false,
    requiresManualConfirm: true,
    fallbacks,
    explanations: [
      "Uncertain match — below confidence threshold.",
      "Use manual selection, manual search, or new product option.",
      "AI will not auto-sell or auto-create an incorrect product.",
    ],
    trace: [...trace, { step: "result", detail: "uncertain" }],
  };
}

/** Merge OCR/hint text into structured signals (deterministic, no external model). */
export function mergeSignalsFromHint(
  signals: ProductSignals,
  hintText?: string,
): ProductSignals {
  const free = [signals.freeText, hintText].filter(Boolean).join(" ").trim();
  const next = { ...signals, freeText: free || signals.freeText };
  const text = norm(free);
  if (!text) return next;

  const watt = text.match(/(\d+(?:\.\d+)?)\s*w\b/);
  if (watt && next.watt == null) next.watt = Number(watt[1]);

  return next;
}
