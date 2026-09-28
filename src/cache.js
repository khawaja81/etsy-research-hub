// Small in-memory TTL cache with a max size (oldest entries are evicted first).
export class TTLCache {
  constructor({ max = 500, ttlMs = 60 * 60 * 1000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh recency
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    while (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value);
    }
  }

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

// Runs an async factory once per key while a call is in flight, and caches the result.
export async function cached(cache, key, factory, ttlMs) {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!cache.pending) cache.pending = new Map();
  if (cache.pending.has(key)) return cache.pending.get(key);
  const p = (async () => {
    try {
      const value = await factory();
      cache.set(key, value, ttlMs);
      return value;
    } finally {
      cache.pending.delete(key);
    }
  })();
  cache.pending.set(key, p);
  return p;
}
