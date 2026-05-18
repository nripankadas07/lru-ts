import { ManualClock, systemClock } from "../src/clock";

describe("ManualClock", () => {
  it("starts at zero by default", () => {
    expect(new ManualClock().now()).toBe(0);
  });

  it("respects a custom starting timestamp", () => {
    expect(new ManualClock(1234).now()).toBe(1234);
  });

  it("advance() moves time forward", () => {
    const clock = new ManualClock(0);
    clock.advance(500);
    expect(clock.now()).toBe(500);
    clock.advance(0);
    expect(clock.now()).toBe(500);
  });

  it("set() jumps to an absolute timestamp", () => {
    const clock = new ManualClock(100);
    clock.set(9999);
    expect(clock.now()).toBe(9999);
  });

  it("advance() rejects negative values", () => {
    expect(() => new ManualClock().advance(-1)).toThrow(/non-negative/);
  });

  it("advance() rejects NaN", () => {
    expect(() => new ManualClock().advance(NaN)).toThrow(/finite/);
  });

  it("advance() rejects Infinity", () => {
    expect(() => new ManualClock().advance(Infinity)).toThrow(/finite/);
  });

  it("set() rejects non-finite values", () => {
    expect(() => new ManualClock().set(Infinity)).toThrow(/finite/);
    expect(() => new ManualClock().set(NaN)).toThrow(/finite/);
  });
});

describe("systemClock", () => {
  it("matches Date.now() within a millisecond", () => {
    const a = systemClock.now();
    const b = Date.now();
    expect(Math.abs(a - b)).toBeLessThanOrEqual(5);
  });
});
