// Minimal in-memory cache with per-entry TTL and a max-size cap.
//
// Lives in the Node process's memory (no external store). Entries expire after
// ttlMs; when the cache is full, the least-recently-used entry is evicted so
// memory stays bounded. Good enough for a single instance — swap for Redis if
// we ever run multiple instances or need the cache to survive restarts.
class TtlCache {
  constructor({ ttlMs, maxEntries }) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    // Map preserves insertion order, which we use for LRU eviction.
    this.map = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const entry = this.map.get(key);
    if (entry === undefined) return undefined;

    // Expired → drop it and report a miss.
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Mark as most-recently-used by reinserting at the end.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    // Evict the oldest entry if we're at capacity and adding a new key.
    if (this.map.size >= this.maxEntries && !this.map.has(key)) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

module.exports = { TtlCache };
