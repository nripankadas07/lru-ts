# lru-ts

Type-safe LRU cache for TypeScript with optional TTL, eviction callbacks,
runtime stats, and an injectable clock for deterministic tests.

* Generic `LruCache<K, V>` — works with any hashable key type
* Per-entry TTL with lazy expiry on access
* `onEvict(key, value, reason)` callback distinguishes capacity / TTL /
  manual / replace / clear evictions
* `resize()` to grow or shrink at runtime
* Hit/miss/eviction/expiration counters with computed `hitRate`
* Iterates in least-recently-used → most-recently-used order
* Backed by an insertion-ordered `Map`; `get`/`set` are O(1)
* Zero runtime dependencies
* `tsc --strict` clean (with `exactOptionalPropertyTypes`,
  `noImplicitAny`, etc.)
* 100 % line / branch / function / statement coverage

## Install

```bash
npm install && npm run build
```

## Usage

```ts
import { LruCache, ManualClock } from "lru-ts";

const cache = new LruCache<string, number>({ maxSize: 100, ttl: 30_000 });

cache.set("user:42", 12345);
cache.get("user:42");           // 12345
cache.has("user:42");           // true
cache.delete("user:42");        // true

// onEvict — discriminate evictions by reason.
const cache2 = new LruCache<string, string>({
  maxSize: 3,
  onEvict: (key, value, reason) => {
    console.log(`evict ${key}=${value} (${reason})`);
  },
});

// Per-entry TTL override.
cache2.set("session", "abc", { ttl: 5_000 });

// Deterministic testing with ManualClock.
const clock = new ManualClock(0);
const test = new LruCache<string, number>({ maxSize: 4, ttl: 100, clock });
test.set("a", 1);
clock.advance(120);
test.get("a");                   // undefined (expired)
```

## API

### `new LruCache<K, V>(options)`

| Option       | Type                                       | Description                              |
| ------------ | ------------------------------------------ | ---------------------------------------- |
| `maxSize`    | `number` (positive integer, required)      | Maximum number of live entries.          |
| `ttl?`       | `number` (ms; `0` or omit disables TTL)    | Default per-entry TTL.                   |
| `onEvict?`   | `(k, v, reason) => void`                   | Eviction callback.                        |
| `clock?`     | `Clock`                                    | Injectable clock; defaults to `Date.now`. |

#### Methods

* `set(key, value, options?) -> this` — insert / overwrite, then promote to MRU
* `get(key) -> V | undefined` — hit/miss with recency promotion
* `peek(key) -> V | undefined` — read without recency promotion
* `has(key) -> boolean` — presence (drops expired entries)
* `delete(key) -> boolean` — explicit removal (fires `onEvict("manual")`)
* `clear() -> void` — drop everything (fires `onEvict("clear")` for each)
* `touch(key) -> boolean` — promote without changing the value
* `resize(newMaxSize) -> void` — adjust capacity; shrinking evicts LRU first
* `keys()`, `values()`, `entries()` — LRU → MRU iterators (skip expired)
* `stats() -> { hits, misses, evictions, expirations, hitRate }`
* `resetStats() -> void`
* `[Symbol.iterator]()` — iterate `[K, V]` tuples in LRU → MRU order

#### Properties

* `size` — current entry count
* `maxSize` — current capacity
* `defaultTtl` — `number | undefined`

### Eviction reasons

| Reason       | When it fires                                            |
| ------------ | -------------------------------------------------------- |
| `"capacity"` | LRU evicted because the cache was at capacity            |
| `"ttl"`      | Entry was lazily dropped after its TTL elapsed           |
| `"replace"`  | `set()` overwrote an existing key                        |
| `"manual"`   | `delete(key)` removed an entry                           |
| `"clear"`    | `clear()` removed an entry                               |

### `ManualClock`

A controllable `Clock` for tests:

```ts
const clock = new ManualClock(0);
clock.advance(500);    // now is 500
clock.set(2_000);      // jump to 2_000
clock.now();           // 2_000
```

### Errors

```
LruCacheError
└── InvalidOptionError  // exposes `.option` (e.g. "maxSize", "ttl")
```

## Running tests

```bash
npm install
npm test
```

The suite contains 73 tests across api surface, clock, options validation,
cache mechanics, and integration scenarios.  Coverage is gated at 100 % on
every metric (lines / branches / functions / statements).

## License

MIT
