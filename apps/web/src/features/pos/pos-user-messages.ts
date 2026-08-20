/**
 * Cashier-facing POS copy. Never surface raw Supabase / Postgres / HTTP guts.
 * Developers still get the original error via logPosDeveloperError.
 */

import {
  formatOnlineFailure,
  isBrowserOnline,
  isNetworkFailure,
} from "@/lib/online-required";

export type PosFeedbackTone = "info" | "danger" | "success" | "warning";

export type PosUserMessage = {
  title: string;
  description: string;
};

export type PosCatalogFeedback = {
  tone: "info" | "danger";
  title: string;
  description?: string;
};

const INFRA_ERROR =
  /PGRST\d+|postgrest|supabase|postgres|duplicate key value|unique constraint|violates (foreign|unique|check|not-null)|row-level security|permission denied for (table|schema|relation)|jwt expired|invalid jwt|22P02|23505|23503|42P01|42703|syntax error at|Failed query|ECONNREFUSED|ENOTFOUND|internal server error|HTTP \d{3}|column .+ does not exist|relation .+ does not exist|undefined_(column|table)|code\s*[:=]/i;

/** Known domain / API phrases → plain language for the register. */
const KNOWN_MESSAGES: Array<{ match: RegExp; message: string }> = [
  {
    match: /out of stock/i,
    message: "This product is out of stock and cannot be sold right now.",
  },
  {
    match: /insufficient stock/i,
    message: "Not enough stock for this quantity. Reduce the quantity or choose another product.",
  },
  {
    match: /already in progress|duplicate payment|duplicate sale|duplicate submission/i,
    message: "This payment is already being processed. Please wait or retry once it finishes.",
  },
  {
    match: /walk-in sales must be paid/i,
    message: "Walk-in customers must pay the full amount before completing the sale.",
  },
  {
    match: /hold has expired/i,
    message: "This hold has expired. Duplicate it or start a new sale.",
  },
  {
    match: /another cashier/i,
    message: "This hold belongs to another cashier. A supervisor with resume permission can take it over.",
  },
  {
    match: /empty cart|cannot hold an empty/i,
    message: "Add at least one product before holding this sale.",
  },
  {
    match: /sku already exists|duplicate.*sku/i,
    message: "Product could not be added because this SKU already exists.",
  },
  {
    match: /payment is less than grand|less than grand total/i,
    message: "Payment is less than the total. Enter the full amount or select a customer for credit.",
  },
  {
    match: /internet|connection required|failed to fetch|network/i,
    message: "No internet connection. Connect and try again — nothing was saved.",
  },
  {
    match: /warehouse/i,
    message: "Select a warehouse before continuing.",
  },
  {
    match: /branch/i,
    message: "No branch is selected. Choose a branch and try again.",
  },
];

export function looksLikeInfrastructureError(text: string): boolean {
  return INFRA_ERROR.test(text);
}

export function logPosDeveloperError(context: string, err: unknown): void {
  const detail = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err;
  // eslint-disable-next-line no-console
  console.error(`[POS] ${context}`, detail);
}

/**
 * Turn any thrown value into a safe cashier sentence.
 * Infrastructure / DB payloads collapse to `fallback`.
 */
export function toPosUserDescription(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const text = String(raw ?? "").trim();
  if (!text) return fallback;
  if (looksLikeInfrastructureError(text)) return fallback;
  for (const row of KNOWN_MESSAGES) {
    if (row.match.test(text)) return row.message;
  }
  if (text.length > 160) return fallback;
  return text;
}

export function humanizeCartError(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim();
  if (!text) return "This product could not be added. Check quantity and stock.";
  return toPosUserDescription(text, "This product could not be added. Check quantity and stock.");
}

export function productSearchEmptyCopy(input: {
  searchingCatalog: boolean;
  tab: "recent" | "favorites" | "categories" | "results";
  query: string;
}): { title: string; description: string } {
  if (input.searchingCatalog || input.tab === "results") {
    const q = input.query.trim();
    return {
      title: "No products found for this search.",
      description: q
        ? `Nothing matched “${q}”. Try another name, barcode, SKU, brand, or category.`
        : "Try name, barcode, SKU, brand, model, or category. Only live catalog items are shown.",
    };
  }
  if (input.tab === "favorites") {
    return {
      title: "No favorite products yet",
      description: "Tap ★ on a product card to keep it here for fast add.",
    };
  }
  if (input.tab === "categories") {
    return {
      title: "No products in this category",
      description: "Choose another category or search by name, barcode, or SKU.",
    };
  }
  return {
    title: "No recent products yet",
    description: "Add a catalog product and it will appear here for the next sale.",
  };
}

export function cartEmptyCopy(): { title: string; description: string } {
  return {
    title: "Cart is empty",
    description: "Search or scan a product to start this sale.",
  };
}

export function holdEmptyCopy(): { title: string; description: string } {
  return {
    title: "No held sales",
    description: "Hold a cart from New Sale when a customer needs more time. Held sales never change stock.",
  };
}

export function payProcessingLabel(confirmation: string | null | undefined): string | null {
  if (confirmation === "pending") return "Processing payment…";
  if (confirmation === "success") return "Payment completed";
  return null;
}

export function formatPosFailure(
  err: unknown,
  operation:
    | "sale"
    | "payment"
    | "return"
    | "exchange"
    | "stock"
    | "hold"
    | "search"
    | "generic" = "generic",
): PosUserMessage {
  logPosDeveloperError(operation, err);

  const onlineOp =
    operation === "search" || operation === "generic" ? "generic" : operation;
  if (!isBrowserOnline() || isNetworkFailure(err)) {
    return formatOnlineFailure(err, onlineOp);
  }

  const opLabel =
    operation === "sale"
      ? "Sale"
      : operation === "payment"
        ? "Payment"
        : operation === "return"
          ? "Return"
          : operation === "exchange"
            ? "Exchange"
            : operation === "stock"
              ? "Stock"
              : operation === "hold"
                ? "Hold"
                : operation === "search"
                  ? "Product search"
                  : "Action";

  const fallback =
    operation === "payment"
      ? "Payment could not be completed. Check the amount and connection, then try again."
      : operation === "hold"
        ? "The sale could not be held. Check your connection and try again."
        : operation === "search"
          ? "Products could not be loaded. Check your connection and try again."
          : `${opLabel} could not be completed. Check your connection and try again.`;

  return {
    title: `${opLabel} could not be completed`,
    description: toPosUserDescription(err, fallback),
  };
}
