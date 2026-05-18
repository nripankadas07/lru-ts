/**
 * Public type aliases for `lru-ts`.
 */
import type { Clock } from "./clock";

/** Why a key was evicted from the cache. */
export type EvictionReason = "capacity" | "ttl" | "manual" | "replace" | "clear";

/** Callback invoked when an entry leaves the cache. */
export type EvictionListener<K, V> = (
  key: K,
  value: V,
  reason: EvictionReason,
) => void;

/** Options accepted by the `LruCache` constructor. */
export interface LruCacheOptions<K, V> {
  /** Maximum number of entries; required, must be a positive finite integer. */
  maxSize: number;
  /** Default per-entry TTL in milliseconds.  `undefined`/`0` disables TTL. */
  ttl?: number;
  /** Callback fired for every eviction (capacity / ttl / manual / replace). */
  onEvict?: EvictionListener<K, V>;
  /** Override the wall clock; defaults to `Date.now()`. */
  clock?: Clock;
}

/** Options accepted by `LruCache.set`. */
export interface SetOptions {
  /** Override the cache-wide TTL for this entry; `0` disables TTL. */
  ttl?: number;
}

/** Read-only snapshot of cache statistics. */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  /** Hits divided by (hits + misses); `0` if the cache has never been read. */
  hitRate: number;
}
