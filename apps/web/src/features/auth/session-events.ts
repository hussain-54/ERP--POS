/** Cross-cutting auth session events (avoid React/api circular imports). */

export const SESSION_EXPIRED_EVENT = "erp:session-expired";
export const SESSION_TOKENS_UPDATED_EVENT = "erp:session-tokens-updated";

export type SessionExpiredReason = "expired" | "invalid" | "inactivity" | "logout";

export function emitSessionExpired(reason: SessionExpiredReason, message?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: {
        reason,
        message:
          message ??
          (reason === "inactivity"
            ? "Your session ended due to inactivity. Please sign in again."
            : "Your session has expired. Please sign in again."),
      },
    }),
  );
}

export function emitSessionTokensUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_TOKENS_UPDATED_EVENT));
}
