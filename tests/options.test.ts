import { InvalidOptionError, LruCache } from "../src";

describe("constructor options validation", () => {
  describe("maxSize", () => {
    it("rejects zero", () => {
      expect(() => new LruCache({ maxSize: 0 })).toThrow(InvalidOptionError);
    });

    it("rejects negative", () => {
      expect(() => new LruCache({ maxSize: -3 })).toThrow(InvalidOptionError);
    });

    it("rejects non-integer", () => {
      expect(() => new LruCache({ maxSize: 1.5 })).toThrow(/integer/);
    });

    it("rejects NaN", () => {
      expect(() => new LruCache({ maxSize: NaN })).toThrow(/finite/);
    });

    it("rejects Infinity", () => {
      expect(() => new LruCache({ maxSize: Infinity })).toThrow(/finite/);
    });

    it("rejects non-number", () => {
      expect(() =>
        new LruCache({ maxSize: "10" as unknown as number }),
      ).toThrow(/finite/);
    });

    it("accepts positive integer", () => {
      expect(() => new LruCache({ maxSize: 1 })).not.toThrow();
    });
  });

  describe("ttl", () => {
    it("accepts undefined", () => {
      const cache = new LruCache({ maxSize: 10 });
      expect(cache.defaultTtl).toBeUndefined();
    });

    it("treats 0 as 'no ttl'", () => {
      const cache = new LruCache({ maxSize: 10, ttl: 0 });
      expect(cache.defaultTtl).toBeUndefined();
    });

    it("stores positive value", () => {
      const cache = new LruCache({ maxSize: 10, ttl: 1500 });
      expect(cache.defaultTtl).toBe(1500);
    });

    it("rejects negative", () => {
      expect(() => new LruCache({ maxSize: 10, ttl: -1 })).toThrow(InvalidOptionError);
    });

    it("rejects NaN", () => {
      expect(() => new LruCache({ maxSize: 10, ttl: NaN })).toThrow(/finite/);
    });

    it("rejects Infinity", () => {
      expect(() => new LruCache({ maxSize: 10, ttl: Infinity })).toThrow(/finite/);
    });

    it("rejects non-number", () => {
      expect(() =>
        new LruCache({ maxSize: 10, ttl: "100" as unknown as number }),
      ).toThrow(/finite/);
    });
  });

  describe("InvalidOptionError shape", () => {
    it("exposes the offending option name", () => {
      try {
        new LruCache({ maxSize: 0 });
        fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidOptionError);
        expect((err as InvalidOptionError).option).toBe("maxSize");
      }
    });
  });
});

describe("resize options validation", () => {
  it("rejects non-positive", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(() => cache.resize(0)).toThrow(InvalidOptionError);
    expect(() => cache.resize(-2)).toThrow(InvalidOptionError);
  });

  it("rejects non-integer", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(() => cache.resize(2.5)).toThrow(InvalidOptionError);
  });
});

describe("set options validation", () => {
  it("rejects negative ttl override", () => {
    const cache = new LruCache<string, number>({ maxSize: 4 });
    expect(() => cache.set("a", 1, { ttl: -5 })).toThrow(InvalidOptionError);
  });
});
