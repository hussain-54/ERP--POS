/**
 * In-session TTL cache + in-flight dedupe for POS bootstrap APIs.
 * Real data only — no mocks. Cleared on catalog change when relevant.
 */

type CacheEntry<T> = {
  at: number;
  value?: T;
  promise?: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

export const POS_BOOTSTRAP_TTL_MS = 60_000;

export function clearPosBootstrapCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cachedPosFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = POS_BOOTSTRAP_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && now - existing.at < ttlMs) {
    return Promise.resolve(existing.value);
  }
  if (existing?.promise) return existing.promise;

  const promise = loader()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });

  store.set(key, { at: 0, promise });
  return promise;
}
