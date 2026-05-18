import { LruCache, ManualClock } from "../src";

describe("integration", () => {
  it("works as a memoize backing store", () => {
    const cache = new LruCache<string, number>({ maxSize: 100 });
    let calls = 0;
    const square = (n: number): number => {
      const key = String(n);
      const cached = cache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      calls += 1;
      const result = n * n;
      cache.set(key, result);
      return result;
    };
    expect(square(4)).toBe(16);
    expect(square(4)).toBe(16);
    expect(square(5)).toBe(25);
    expect(calls).toBe(2);
  });

  it("ttl-only cache loses everything after the TTL window", () => {
    const clock = new ManualClock(0);
    const cache = new LruCache<string, string>({
      maxSize: 10,
      ttl: 30,
      clock,
    });
    cache.set("a", "A").set("b", "B").set("c", "C");
    clock.advance(31);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBeUndefined();
  });

  it("works with non-string keys (object identity)", () => {
    const cache = new LruCache<object, string>({ maxSize: 4 });
    const k1 = { id: 1 };
    const k2 = { id: 1 }; // different identity from k1.
    cache.set(k1, "first").set(k2, "second");
    expect(cache.get(k1)).toBe("first");
    expect(cache.get(k2)).toBe("second");
  });

  it("works with number keys", () => {
    const cache = new LruCache<number, boolean>({ maxSize: 4 });
    cache.set(1, true).set(2, false);
    expect(cache.get(1)).toBe(true);
    expect(cache.get(2)).toBe(false);
  });

  it("preserves recency across mixed reads and writes", () => {
    const cache = new LruCache<string, number>({ maxSize: 3 });
    cache.set("a", 1).set("b", 2).set("c", 3);
    cache.get("a"); // a is MRU; b is LRU; c is middle.
    cache.set("d", 4); // b should be evicted.
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("supports a moderately large workload", () => {
    const cache = new LruCache<number, number>({ maxSize: 50 });
    for (let i = 0; i < 200; i++) {
      cache.set(i, i * 2);
    }
    expect(cache.size).toBe(50);
    // The last 50 inserts should still be present.
    expect(cache.has(199)).toBe(true);
    expect(cache.has(150)).toBe(true);
    expect(cache.has(149)).toBe(false);
    expect(cache.has(0)).toBe(false);
  });
});
