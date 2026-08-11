import type { SyncPullRequest, SyncPushRequest } from "@electronic-erp/contracts";

export type SyncTransport = {
  push: (
    request: SyncPushRequest,
  ) => Promise<{ accepted: number; conflicts: number; duplicateSkipped?: number }>;
  pull: (
    request: SyncPullRequest,
  ) => Promise<{ cursor: string | null; rows: unknown[] }>;
};

/** Bidirectional sync engine — online gate + transport; coordinator owns outbox/inbox. */
export class SyncEngine {
  private online = true;

  constructor(private readonly transport: SyncTransport) {}

  setOnline(online: boolean): void {
    this.online = online;
  }

  isOnline(): boolean {
    return this.online;
  }

  async push(request: SyncPushRequest) {
    if (!this.online) {
      return { accepted: 0, conflicts: 0, deferred: true as const, duplicateSkipped: 0 };
    }
    const result = await this.transport.push(request);
    return { ...result, deferred: false as const };
  }

  async pull(request: SyncPullRequest) {
    if (!this.online) {
      return { cursor: request.cursor ?? null, rows: [] as unknown[], deferred: true as const };
    }
    const result = await this.transport.pull(request);
    return { ...result, deferred: false as const };
  }
}
