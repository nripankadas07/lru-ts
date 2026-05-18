import * as Lib from "../src";

describe("api surface", () => {
  it("exports the expected named values", () => {
    expect(typeof Lib.LruCache).toBe("function");
    expect(typeof Lib.ManualClock).toBe("function");
    expect(typeof Lib.systemClock.now).toBe("function");
    expect(typeof Lib.LruCacheError).toBe("function");
    expect(typeof Lib.InvalidOptionError).toBe("function");
  });

  it("rooted error hierarchy", () => {
    const e = new Lib.InvalidOptionError("maxSize", "bad");
    expect(e).toBeInstanceOf(Lib.LruCacheError);
    expect(e).toBeInstanceOf(Error);
    expect(e.option).toBe("maxSize");
    expect(e.name).toBe("InvalidOptionError");
  });

  it("LruCacheError preserves name and inheritance", () => {
    const e = new Lib.LruCacheError("oops");
    expect(e.name).toBe("LruCacheError");
    expect(e).toBeInstanceOf(Error);
  });

  it("systemClock returns a finite number near Date.now()", () => {
    const now = Lib.systemClock.now();
    expect(Number.isFinite(now)).toBe(true);
    expect(Math.abs(now - Date.now())).toBeLessThan(1000);
  });
});
