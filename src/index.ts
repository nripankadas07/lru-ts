/**
 * `lru-ts` — type-safe LRU cache with TTL, max-size eviction, and stats.
 *
 * Public surface re-exports `LruCache`, the supporting types, the
 * `ManualClock` helper for tests, and the error hierarchy.
 */
export { LruCache } from "./cache";
export { systemClock, ManualClock } from "./clock";
export type { Clock } from "./clock";
export {
  LruCacheError,
  InvalidOptionError,
} from "./errors";
export type {
  CacheStats,
  EvictionListener,
  EvictionReason,
  LruCacheOptions,
  SetOptions,
} from "./types";
