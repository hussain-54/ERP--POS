/**
 * Isolated AI service layer — orchestrates @electronic-erp/ai engines + DB facts.
 * React / web must not import engines; call HTTP routes only.
 */
import type { AiInsightsQuery, RecognizeProductInput } from "@electronic-erp/contracts";
import {
  classifyAllVelocities,
  findCustomerPatterns,
  forecastDemand,
  mergeSignalsFromHint,
  optimizeProfit,
  predictFutureSales,
  rankProductMatches,
  recommendPurchases,
  resolveRecognitionDecision,
} from "@electronic-erp/ai";
import { AiRepository } from "@electronic-erp/db";

export class AiService {
  constructor(private readonly repo: AiRepository) {}

  async recognizeProduct(input: RecognizeProductInput, userId: string | null) {
    const settings = await this.repo.getSettings(input.organizationId);
    const threshold =
      input.confidenceThreshold ?? (Number(settings.confidence_threshold ?? 0.78) || 0.78);

    const signals = mergeSignalsFromHint(
      {
        brand: input.signals?.brand,
        company: input.signals?.company,
        model: input.signals?.model,
        variant: input.signals?.variant,
        size: input.signals?.size,
        color: input.signals?.color,
        watt: input.signals?.watt,
        specifications: input.signals?.specifications,
        unit: input.signals?.unit,
        freeText: input.signals?.freeText,
      },
      input.hintText,
    );

    const hint = [signals.brand, signals.model, signals.freeText, signals.company]
      .filter(Boolean)
      .join(" ");
    const catalog = await this.repo.loadCatalogCandidates(
      input.organizationId,
      input.warehouseId,
      hint,
    );
    const ranked = rankProductMatches(signals, catalog);
    const decision = resolveRecognitionDecision(ranked, threshold);

    const imageByteLength = input.imageBase64
      ? Math.floor((input.imageBase64.length * 3) / 4)
      : null;

    const event = await this.repo.insertRecognitionEvent({
      organization_id: input.organizationId,
      branch_id: input.branchId ?? null,
      warehouse_id: input.warehouseId ?? null,
      source: input.source ?? "api",
      status: decision.status,
      confidence_threshold: threshold,
      top_confidence: decision.topConfidence,
      signals_json: signals,
      candidates_json: decision.candidates.map((c) => ({
        productId: c.product.productId,
        name: c.product.name,
        confidence: c.confidence,
        matchedFields: c.matchedFields,
        retailPrice: c.product.retailPrice,
        stockAvailable: c.product.stockAvailable,
        brand: c.product.brand,
        model: c.product.model,
        size: c.product.size,
        color: c.product.color,
        watt: c.product.watt,
        unitName: c.product.unitName,
      })),
      explanations_json: decision.explanations,
      trace_json: decision.trace,
      selected_product_id: decision.bestMatch?.product.productId ?? null,
      image_mime_type: input.imageMimeType ?? null,
      image_byte_length: imageByteLength,
      created_by: userId,
    });

    return {
      recognitionEventId: String(event.id),
      decision,
      posHandoff: decision.bestMatch
        ? {
            productId: decision.bestMatch.product.productId,
            label: decision.bestMatch.product.name,
            price: decision.bestMatch.product.retailPrice,
            stockAvailable: decision.bestMatch.product.stockAvailable,
            requiresConfirm: true,
          }
        : null,
    };
  }

  confirmRecognition(input: {
    organizationId: string;
    recognitionEventId: string;
    productId?: string;
    action: "confirm_match" | "manual_select" | "manual_search" | "new_product";
  }) {
    return this.repo.confirmRecognition(input);
  }

  async buildInsights(query: AiInsightsQuery & { organizationId: string }) {
    const settings = await this.repo.getSettings(query.organizationId);
    const velocityCfg = {
      fastDays: query.velocity?.fastDays ?? Number(settings.fast_days ?? 30),
      slowDays: query.velocity?.slowDays ?? Number(settings.slow_days ?? 90),
      stagnantDays: query.velocity?.stagnantDays ?? Number(settings.stagnant_days ?? 180),
    };

    const history = await this.repo.loadDailySales(
      query.organizationId,
      query.lookbackDays ?? 180,
      query.branchId,
    );
    const { products, productSeries, baskets, margins } = await this.repo.loadInsightFacts(
      query.organizationId,
      query.lookbackDays ?? 180,
      query.warehouseId,
    );

    const kind = query.kind ?? "all";
    const result: Record<string, unknown> = {};

    if (kind === "all" || kind === "sales_prediction") {
      result.salesPrediction = predictFutureSales(history, query.horizonDays ?? 30);
    }
    if (kind === "all" || kind === "velocity") {
      result.velocity = classifyAllVelocities(products, velocityCfg);
    }
    if (kind === "all" || kind === "demand_forecast" || kind === "purchase_recommendation") {
      result.demandForecast = forecastDemand(history, productSeries.slice(0, 40));
    }
    if (kind === "all" || kind === "purchase_recommendation") {
      const forecast = result.demandForecast as ReturnType<typeof forecastDemand>;
      const map = new Map(
        forecast.data.byProduct.map((p) => [p.productId, { nextMonthQty: p.nextMonthQty }]),
      );
      result.purchaseRecommendation = recommendPurchases(products, map);
    }
    if (kind === "all" || kind === "customer_patterns") {
      result.customerPatterns = findCustomerPatterns(baskets, 2);
    }
    if (kind === "all" || kind === "profit_optimization") {
      result.profitOptimization = optimizeProfit(margins);
    }

    const explanations: string[] = [];
    const sources: Array<{ table: string; note: string }> = [];
    for (const block of Object.values(result)) {
      if (block && typeof block === "object" && "explanations" in block) {
        explanations.push(...((block as { explanations: string[] }).explanations ?? []));
      }
      if (block && typeof block === "object" && "sources" in block) {
        sources.push(
          ...((block as { sources: Array<{ table: string; note: string }> }).sources ?? []),
        );
      }
    }

    await this.repo.cacheInsight({
      organization_id: query.organizationId,
      kind,
      branch_id: query.branchId ?? null,
      warehouse_id: query.warehouseId ?? null,
      params_json: {
        lookbackDays: query.lookbackDays,
        horizonDays: query.horizonDays,
        velocity: velocityCfg,
      },
      result_json: result,
      explanations_json: explanations,
      sources_json: sources,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    return {
      kind,
      generatedAt: new Date().toISOString(),
      result,
      explanations,
      sources,
      velocityConfig: velocityCfg,
    };
  }

  getSettings(organizationId: string) {
    return this.repo.getSettings(organizationId);
  }

  upsertSettings(
    organizationId: string,
    input: {
      confidenceThreshold?: number;
      fastDays?: number;
      slowDays?: number;
      stagnantDays?: number;
    },
    userId: string | null,
  ) {
    return this.repo.upsertSettings(organizationId, input, userId);
  }
}
