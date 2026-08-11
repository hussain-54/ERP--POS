import type { SyncPullRequest, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncTransport } from "./engine.js";

export type HttpCloudTransportOptions = {
  apiUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
};

/**
 * Cloud sync transport for Electron / online clients.
 * Posts to /api/v1/sync/push and /api/v1/sync/pull with Bearer auth.
 */
export class HttpCloudTransport implements SyncTransport {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpCloudTransportOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.options.getAccessToken();
    if (!token) throw new Error("Missing access token for sync");
    return {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    };
  }

  private base(): string {
    return this.options.apiUrl.replace(/\/$/, "");
  }

  async push(request: SyncPushRequest) {
    const res = await this.fetchImpl(`${this.base()}/api/v1/sync/push`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw new Error(`Sync push failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as {
      accepted: number;
      conflicts: number;
      duplicateSkipped?: number;
    };
  }

  async pull(request: SyncPullRequest) {
    const res = await this.fetchImpl(`${this.base()}/api/v1/sync/pull`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw new Error(`Sync pull failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as { cursor: string | null; rows: unknown[] };
  }
}
