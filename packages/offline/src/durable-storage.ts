/**
 * Durable key/value document store used as the SQLite projection for tests and
 * Electron (file-backed). Same logical tables as OFFLINE_SYNC_ENGINE_SCHEMA.
 */
export interface DurableStorage {
  read(): Promise<Record<string, unknown>>;
  write(data: Record<string, unknown>): Promise<void>;
}

export class MemoryDurableStorage implements DurableStorage {
  private data: Record<string, unknown> = {};

  async read(): Promise<Record<string, unknown>> {
    return structuredClone(this.data);
  }

  async write(data: Record<string, unknown>): Promise<void> {
    this.data = structuredClone(data);
  }

  /** Simulate app restart: keep storage, drop in-memory DB instance separately. */
  snapshot(): Record<string, unknown> {
    return structuredClone(this.data);
  }

  restore(data: Record<string, unknown>): void {
    this.data = structuredClone(data);
  }
}

export class JsonFileDurableStorage implements DurableStorage {
  constructor(
    private readonly io: {
      readFile: () => Promise<string | null>;
      writeFile: (contents: string) => Promise<void>;
    },
  ) {}

  async read(): Promise<Record<string, unknown>> {
    try {
      const raw = await this.io.readFile();
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite/durable storage read failed: ${message}`);
    }
  }

  async write(data: Record<string, unknown>): Promise<void> {
    try {
      await this.io.writeFile(JSON.stringify(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite/durable storage write failed: ${message}`);
    }
  }
}
