/**
 * `LruCache<K, V>` — type-safe LRU cache with optional TTL.
 *
 * The implementation is backed by a `Map` (which is insertion-ordered in every
 * modern JS engine) plus a small amount of bookkeeping for hit/miss/eviction
 * stats.  `get` is O(1); `set` is O(1) amortised; iteration is in
 * least-recently-used order.
 */
import { systemClock } from "./clock";
import { InvalidOptionError } from "./errors";
import type { CacheStats, EvictionReason, LruCacheOptions, SetOptions } from "./types";
import type { Clock } from "./clock";
import type { EvictionListener } from "./types";

interface Entry<V> {
  value: V;
  /** Absolute expiry timestamp in ms, or `undefined` if no TTL. */
  expires: number | undefined;
}

export class LruCache<K, V> {
  private readonly _store: Map<K, Entry<V>>;
  private _maxSize: number;
  private readonly _ttl: number | undefined;
  private readonly _onEvict: EvictionListener<K, V> | undefined;
  private readonly _clock: Clock;
  private _hits: number;
  private _misses: number;
  private _evictions: number;
  private _expirations: number;

  public constructor(options: LruCacheOptions<K, V>) {
    validateMaxSize(options.maxSize);
    validateTtl(options.ttl);
    this._maxSize = options.maxSize;
    this._ttl = normaliseTtl(options.ttl);
    this._onEvict = options.onEvict;
    this._clock = options.clock ?? systemClock;
    this._store = new Map();
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
    this._expirations = 0;
  }

  /** Maximum number of entries the cache will hold. */
  public get maxSize(): number {
    return this._maxSize;
  }

  /** Current number of live entries (counts expired-but-not-evicted entries). */
  public get size(): number {
    return this._store.size;
  }

  /** Default TTL in milliseconds, or `undefined` for "no TTL". */
  public get defaultTtl(): number | undefined {
    return this._ttl;
  }

  /**
   * Insert or overwrite `key` -> `value` and mark it as the most-recently used.
   *
   * If the cache is at capacity, the least-recently-used entry is evicted
   * first.  An overwrite fires `onEvict(key, oldValue, "replace")` for the
   * displaced value.
   */
  public set(key: K, value: V, options?: SetOptions): this {
    validateTtl(options?.ttl);
    const ttl = pickTtl(this._ttl, options?.ttl);
    const expires = ttl === undefined ? undefined : this._clock.now() + ttl;
    const previous = this._store.get(key);
    if (previous !== undefined) {
      this._store.delete(key);
      this._emitEviction(key, previous.value, "replace");
    }
    this._store.set(key, { value, expires });
    this._evictUntilWithinCapacity();
    return this;
  }

  /**
   * Look up `key` and mark the entry as the most-recently used.
   *
   * Returns `undefined` for missing or expired entries.  Expired entries are
   * removed lazily on access.
   */
  public get(key: K): V | undefined {
    const entry = this._store.get(key);
    if (entry === undefined) {
      this._misses += 1;
      return undefined;
    }
    if (this._isExpired(entry)) {
      this._store.delete(key);
      this._emitEviction(key, entry.value, "ttl");
      this._expirations += 1;
      this._misses += 1;
      return undefined;
    }
    // Refresh recency by re-inserting (cheap: just a Map operation).
    this._store.delete(key);
    this._store.set(key, entry);
    this._hits += 1;
    return entry.value;
  }

  /** Look up without touching the recency order; expired entries return `undefined`. */
  public peek(key: K): V | undefined {
    const entry = this._store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (this._isExpired(entry)) {
      return undefined;
    }
    return entry.value;
  }

  /** `true` if `key` is present AND not expired. */
  public has(key: K): boolean {
    const entry = this._store.get(key);
    if (entry === undefined) {
      return false;
    }
    if (this._isExpired(entry)) {
      this._store.delete(key);
      this._emitEviction(key, entry.value, "ttl");
      this._expirations += 1;
      return false;
    }
    return true;
  }

  /** Explicitly remove `key`; returns `true` if the key was present. */
  public delete(key: K): boolean {
    const entry = this._store.get(key);
    if (entry === undefined) {
      return false;
    }
    this._store.delete(key);
    this._emitEviction(key, entry.value, "manual");
    return true;
  }

  /** Drop every entry; fires `onEvict(..., "clear")` for each. */
  public clear(): void {
    for (const [key, entry] of this._store) {
      this._emitEviction(key, entry.value, "clear");
    }
    this._store.clear();
  }

  /** Touch `key` so it becomes most-recently-used.  Returns `true` if present. */
  public touch(key: K): boolean {
    const entry = this._store.get(key);
    if (entry === undefined) {
      return false;
    }
    if (this._isExpired(entry)) {
      this._store.delete(key);
      this._emitEviction(key, entry.value, "ttl");
      this._expirations += 1;
      return false;
    }
    this._store.delete(key);
    this._store.set(key, entry);
    return true;
  }

  /** Adjust the capacity, evicting LRU entries if shrinking. */
  public resize(newMaxSize: number): void {
    validateMaxSize(newMaxSize);
    this._maxSize = newMaxSize;
    this._evictUntilWithinCapacity();
  }

  /** Iterate keys in least-recently-used order (skips expired entries). */
  public *keys(): IterableIterator<K> {
    for (const [key, entry] of this._store) {
      if (!this._isExpired(entry)) {
        yield key;
      }
    }
  }

  /** Iterate values in least-recently-used order (skips expired entries). */
  public *values(): IterableIterator<V> {
    for (const [, entry] of this._store) {
      if (!this._isExpired(entry)) {
        yield entry.value;
      }
    }
  }

  /** Iterate `[key, value]` tuples in least-recently-used order. */
  public *entries(): IterableIterator<[K, V]> {
    for (const [key, entry] of this._store) {
      if (!this._isExpired(entry)) {
        yield [key, entry.value];
      }
    }
  }

  /** A snapshot of the current counters; computed values like `hitRate`. */
  public stats(): CacheStats {
    const total = this._hits + this._misses;
    const hitRate = total === 0 ? 0 : this._hits / total;
    return {
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      expirations: this._expirations,
      hitRate,
    };
  }

  /** Reset every counter to zero.  Does not touch the entries themselves. */
  public resetStats(): void {
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
    this._expirations = 0;
  }

  /** Iterate every key/value pair, used by `for ... of`. */
  public [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  private _emitEviction(key: K, value: V, reason: EvictionReason): void {
    this._evictions += 1;
    if (this._onEvict !== undefined) {
      this._onEvict(key, value, reason);
    }
  }

  private _evictUntilWithinCapacity(): void {
    while (this._store.size > this._maxSize) {
      // `size > maxSize >= 1` guarantees the iterator has at least one entry,
      // so `next().value` is the oldest [K, Entry<V>] tuple.
      const oldest = this._store.entries().next().value as [K, Entry<V>];
      const [oldestKey, oldestEntry] = oldest;
      this._store.delete(oldestKey);
      this._emitEviction(oldestKey, oldestEntry.value, "capacity");
    }
  }

  private _isExpired(entry: Entry<V>): boolean {
    if (entry.expires === undefined) {
      return false;
    }
    return this._clock.now() >= entry.expires;
  }
}

function validateMaxSize(value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidOptionError("maxSize", `expected a finite number, got ${String(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw new InvalidOptionError("maxSize", `expected an integer, got ${value}`);
  }
  if (value <= 0) {
    throw new InvalidOptionError("maxSize", `expected a positive integer, got ${value}`);
  }
}

function validateTtl(value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidOptionError("ttl", `expected a finite number, got ${String(value)}`);
  }
  if (value < 0) {
    throw new InvalidOptionError("ttl", `expected a non-negative number, got ${value}`);
  }
}

function normaliseTtl(value: number | undefined): number | undefined {
  if (value === undefined || value === 0) {
    return undefined;
  }
  return value;
}

function pickTtl(
  defaultTtl: number | undefined,
  override: number | undefined,
): number | undefined {
  if (override === undefined) {
    return defaultTtl;
  }
  if (override === 0) {
    return undefined;
  }
  return override;
}
