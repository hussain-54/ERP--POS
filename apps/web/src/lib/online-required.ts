/**
 * Online-only failure messaging.
 * Never imply SQLite, offline queue, or local persistence succeeded.
 * Never pass raw Supabase / Postgres diagnostics to cashiers.
 */

export const INTERNET_REQUIRED_TITLE = "Connection Required";

export const INTERNET_REQUIRED_MESSAGE =
  "This application needs an active internet connection. Connect and try again. Nothing was saved locally.";

const INFRA_ERROR =
  /PGRST\d+|postgrest|supabase|postgres|duplicate key value|unique constraint|violates (foreign|unique|check|not-null)|row-level security|permission denied for (table|schema|relation)|jwt expired|invalid jwt|22P02|23505|23503|42P01|42703|syntax error at|Failed query|ECONNREFUSED|ENOTFOUND|internal server error|HTTP \d{3}|column .+ does not exist|relation .+ does not exist|undefined_(column|table)/i;

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** True when the error looks like a network / unreachable API failure. */
export function isNetworkFailure(err: unknown): boolean {
  if (err == null) return false;
  if (typeof TypeError !== "undefined" && err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed|err_internet|err_connection|err_name_not_resolved|econnrefused|econnreset|enotfound|etimedout|fetch failed|aborted/i.test(
    msg,
  );
}

function sanitizeCashierDescription(raw: string, fallback: string): string {
  const text = raw.trim();
  if (!text) return fallback;
  if (INFRA_ERROR.test(text) || text.length > 180) return fallback;
  return text;
}

/**
 * Map API / fetch errors to a cashier-facing message.
 * Critical ops must never look like a local success.
 */
export function formatOnlineFailure(
  err: unknown,
  operation?: "sale" | "payment" | "return" | "exchange" | "stock" | "hold" | "generic",
): { title: string; description: string } {
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
              ? "Stock update"
              : operation === "hold"
                ? "Hold"
                : "Operation";

  if (!isBrowserOnline() || isNetworkFailure(err)) {
    return {
      title: INTERNET_REQUIRED_TITLE,
      description: `${opLabel} was not completed. ${INTERNET_REQUIRED_MESSAGE}`,
    };
  }

  const raw = err instanceof Error ? err.message : "Request failed";
  const fallback = `${opLabel} could not be completed. Check your connection and try again.`;
  return {
    title: `${opLabel} could not be completed`,
    description: sanitizeCashierDescription(raw, fallback),
  };
}

type ToastPush = (t: {
  title: string;
  description?: string;
  tone: "danger" | "success" | "info";
}) => void;

/** Pre-flight gate before critical online writes. */
export function requireInternetConnection(push: ToastPush): boolean {
  if (isBrowserOnline()) return true;
  push({
    title: INTERNET_REQUIRED_TITLE,
    description: INTERNET_REQUIRED_MESSAGE,
    tone: "danger",
  });
  return false;
}
