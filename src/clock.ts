/**
 * Pluggable clock abstraction for deterministic tests.
 *
 * The cache reads "now" only through this interface; tests can pass a custom
 * implementation to advance time manually.
 */

/** Anything that can report a monotonic millisecond timestamp. */
export interface Clock {
  /** Return the current time as a millisecond timestamp. */
  now(): number;
}

/**
 * Default clock backed by `Date.now()`.
 *
 * Resolution is one millisecond; this is sufficient for typical cache TTLs.
 */
export const systemClock: Clock = {
  now(): number {
    return Date.now();
  },
};

/**
 * A controllable clock useful for tests.
 *
 * Construct with an optional starting timestamp, then call `advance(ms)` to
 * move time forward.  `set(timestamp)` jumps to an absolute value.
 */
export class ManualClock implements Clock {
  private _now: number;

  public constructor(start: number = 0) {
    this._now = start;
  }

  public now(): number {
    return this._now;
  }

  public advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error(
        `ManualClock.advance: milliseconds must be a non-negative finite number, got ${milliseconds}`,
      );
    }
    this._now += milliseconds;
  }

  public set(timestamp: number): void {
    if (!Number.isFinite(timestamp)) {
      throw new Error(
        `ManualClock.set: timestamp must be a finite number, got ${timestamp}`,
      );
    }
    this._now = timestamp;
  }
}
