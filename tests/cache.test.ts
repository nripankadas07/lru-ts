import { LruCache, ManualClock } from "../src";

describe("basic operations", () => {
  it("set + get returns the stored value", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("get on missing key returns undefined", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(cache.get("nope")).toBeUndefined();
  });

  it("has() reports presence", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("delete() returns whether the key was present", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1);
    expect(cache.delete("a")).toBe(true);
    expect(cache.delete("a")).toBe(false);
    expect(cache.size).toBe(0);
  });

  it("clear() empties the cache", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1).set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("size reports current count", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(cache.size).toBe(0);
    cache.set("a", 1);
    expect(cache.size).toBe(1);
  });

  it("set() returns this for chaining", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(cache.set("a", 1)).toBe(cache);
  });

  it("peek() returns the value without touching recency", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2);
    expect(cache.peek("a")).toBe(1);
    cache.set("c", 3); // a was peeked but is still LRU; should be evicted.
    expect(cache.has("a")).toBe(false);
  });

  it("peek() returns undefined for missing keys", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    expect(cache.peek("nope")).toBeUndefined();
  });

  it("touch() promotes a key without changing the value", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2);
    expect(cache.touch("a")).toBe(true);
    cache.set("c", 3); // a was touched; b is LRU.
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("touch() returns false for missing keys", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    expect(cache.touch("nope")).toBe(false);
  });
});

describe("LRU eviction", () => {
  it("evicts least-recently-used on overflow", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2);
    cache.set("c", 3);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
  });

  it("get() promotes a key to most-recently-used", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2);
    cache.get("a"); // now b is LRU.
    cache.set("c", 3);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("overwriting replaces value and refreshes recency", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2);
    cache.set("a", 10);
    cache.set("c", 3); // b should be LRU now.
    expect(cache.get("a")).toBe(10);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("fires onEvict with reason='capacity'", () => {
    const events: Array<[string, number, string]> = [];
    const cache = new LruCache<string, number>({
      maxSize: 2,
      onEvict: (k, v, r) => events.push([k, v, r]),
    });
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect(events).toEqual([["a", 1, "capacity"]]);
  });

  it("fires onEvict with reason='replace' for overwrites", () => {
    const events: Array<[string, number, string]> = [];
    const cache = new LruCache<string, number>({
      maxSize: 2,
      onEvict: (k, v, r) => events.push([k, v, r]),
    });
    cache.set("a", 1).set("a", 2);
    expect(events).toEqual([["a", 1, "replace"]]);
  });

  it("fires onEvict with reason='manual' for delete", () => {
    const events: Array<[string, number, string]> = [];
    const cache = new LruCache<string, number>({
      maxSize: 2,
      onEvict: (k, v, r) => events.push([k, v, r]),
    });
    cache.set("a", 1);
    cache.delete("a");
    expect(events).toEqual([["a", 1, "manual"]]);
  });

  it("fires onEvict with reason='clear'", () => {
    const events: Array<[string, number, string]> = [];
    const cache = new LruCache<string, number>({
      maxSize: 4,
      onEvict: (k, v, r) => events.push([k, v, r]),
    });
    cache.set("a", 1).set("b", 2);
    cache.clear();
    expect(events).toEqual([
      ["a", 1, "clear"],
      ["b", 2, "clear"],
    ]);
  });
});

describe("TTL behaviour", () => {
  it("expires entries after the default TTL elapses", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 100,
      clock,
    });
    cache.set("a", 1);
    clock.advance(50);
    expect(cache.get("a")).toBe(1);
    clock.advance(60); // total elapsed = 110ms > 100ms TTL.
    expect(cache.get("a")).toBeUndefined();
  });

  it("expires at the TTL boundary (>= comparison)", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 100,
      clock,
    });
    cache.set("a", 1);
    clock.advance(100);
    expect(cache.get("a")).toBeUndefined();
  });

  it("per-entry ttl override wins over default", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 1000,
      clock,
    });
    cache.set("a", 1, { ttl: 50 });
    clock.advance(60);
    expect(cache.get("a")).toBeUndefined();
  });

  it("per-entry ttl=0 disables TTL for this entry", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 50,
      clock,
    });
    cache.set("a", 1, { ttl: 0 });
    clock.advance(1_000_000);
    expect(cache.get("a")).toBe(1);
  });

  it("expired entries are dropped lazily and reported via onEvict", () => {
    const clock = new ManualClock(0);
    const events: Array<[string, number, string]> = [];
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 10,
      clock,
      onEvict: (k, v, r) => events.push([k, v, r]),
    });
    cache.set("a", 1);
    clock.advance(100);
    expect(cache.has("a")).toBe(false);
    expect(events).toEqual([["a", 1, "ttl"]]);
  });

  it("has() drops expired entries", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 5,
      clock,
    });
    cache.set("a", 1);
    clock.advance(100);
    expect(cache.has("a")).toBe(false);
    expect(cache.size).toBe(0);
  });

  it("peek() returns undefined for expired entries", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 5,
      clock,
    });
    cache.set("a", 1);
    clock.advance(100);
    expect(cache.peek("a")).toBeUndefined();
  });

  it("touch() drops expired entries instead of refreshing", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 5,
      clock,
    });
    cache.set("a", 1);
    clock.advance(100);
    expect(cache.touch("a")).toBe(false);
    expect(cache.size).toBe(0);
  });
});

describe("resize", () => {
  it("growing capacity keeps all entries", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2);
    cache.resize(10);
    expect(cache.maxSize).toBe(10);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(true);
  });

  it("shrinking capacity evicts least-recently-used", () => {
    const events: Array<[string, number, string]> = [];
    const cache = new LruCache<string, number>({
      maxSize: 4,
      onEvict: (k, v, r) => events.push([k, v, r]),
    });
    cache.set("a", 1).set("b", 2).set("c", 3).set("d", 4);
    cache.resize(2);
    expect(cache.size).toBe(2);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
    expect(events).toEqual([
      ["a", 1, "capacity"],
      ["b", 2, "capacity"],
    ]);
  });
});

describe("iteration", () => {
  it("keys()/values()/entries() iterate LRU -> MRU", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1).set("b", 2).set("c", 3);
    cache.get("a"); // a becomes MRU; order now: b, c, a.
    expect(Array.from(cache.keys())).toEqual(["b", "c", "a"]);
    expect(Array.from(cache.values())).toEqual([2, 3, 1]);
    expect(Array.from(cache.entries())).toEqual([
      ["b", 2],
      ["c", 3],
      ["a", 1],
    ]);
  });

  it("for..of iterates entries", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1).set("b", 2);
    const collected: Array<[string, number]> = [];
    for (const pair of cache) {
      collected.push(pair);
    }
    expect(collected).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("iteration skips expired entries", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 10,
      clock,
    });
    cache.set("a", 1);
    clock.advance(100);
    cache.set("b", 2, { ttl: 1000 });
    expect(Array.from(cache.keys())).toEqual(["b"]);
    expect(Array.from(cache.values())).toEqual([2]);
    expect(Array.from(cache.entries())).toEqual([["b", 2]]);
  });
});

describe("stats", () => {
  it("starts at zero", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(cache.stats()).toEqual({
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      hitRate: 0,
    });
  });

  it("counts hits and misses", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1);
    cache.get("a");
    cache.get("a");
    cache.get("missing");
    const stats = cache.stats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });

  it("counts capacity evictions", () => {
    const cache = new LruCache<string, number>({ maxSize: 2 });
    cache.set("a", 1).set("b", 2).set("c", 3);
    expect(cache.stats().evictions).toBe(1);
  });

  it("counts expirations distinctly from evictions", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, number>({
      maxSize: 4,
      ttl: 5,
      clock,
    });
    cache.set("a", 1);
    clock.advance(100);
    cache.get("a");
    const stats = cache.stats();
    expect(stats.expirations).toBe(1);
    expect(stats.evictions).toBe(1); // the ttl drop is also an eviction.
    expect(stats.misses).toBe(1);
  });

  it("resetStats clears counters but keeps data", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    cache.set("a", 1);
    cache.get("a");
    cache.resetStats();
    expect(cache.stats()).toEqual({
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      hitRate: 0,
    });
    expect(cache.get("a")).toBe(1); // data still there.
  });
});
