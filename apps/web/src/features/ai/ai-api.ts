import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const aiApi = {
  recognize(body: Record<string, unknown>) {
    return apiFetch<{
      recognitionEventId: string;
      decision: {
        status: string;
        topConfidence: number;
        confidenceThreshold: number;
        allowAutoSell: boolean;
        allowAutoCreate: boolean;
        requiresManualConfirm: boolean;
        explanations: string[];
        fallbacks: string[];
        candidates: Array<{
          product: {
            productId: string;
            name: string;
            retailPrice?: number | null;
            stockAvailable?: number | null;
            brand?: string | null;
            model?: string | null;
            size?: string | null;
            color?: string | null;
            watt?: number | null;
            unitName?: string | null;
          };
          confidence: number;
          explanation: string;
        }>;
        similar: Array<{ product: { productId: string; name: string }; confidence: number }>;
        bestMatch: { product: { productId: string; name: string }; confidence: number } | null;
        trace: Array<{ step: string; detail: string }>;
      };
      posHandoff: {
        productId: string;
        label: string;
        price?: number | null;
        stockAvailable?: number | null;
        requiresConfirm: boolean;
      } | null;
    }>("/api/v1/ai/recognize-product", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  confirm(body: Record<string, unknown>) {
    return apiFetch("/api/v1/ai/recognize-product/confirm", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  insights(body: Record<string, unknown> = {}) {
    return apiFetch<{
      kind: string;
      generatedAt: string;
      result: Record<string, unknown>;
      explanations: string[];
      sources: Array<{ table: string; note: string }>;
      velocityConfig: { fastDays: number; slowDays: number; stagnantDays: number };
    }>("/api/v1/ai/insights", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  getSettings() {
    return apiFetch<{ item: Record<string, unknown> }>("/api/v1/ai/settings", {
      token: token(),
    });
  },

  saveSettings(body: Record<string, unknown>) {
    return apiFetch("/api/v1/ai/settings", {
      method: "PUT",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
