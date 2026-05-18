/**
 * Error hierarchy for `lru-ts`.
 *
 * All errors raised by the public API derive from `LruCacheError`, so callers
 * can catch one class to handle every library-specific failure.
 */

/** Base class for every error raised by `lru-ts`. */
export class LruCacheError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LruCacheError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised when constructor / method options are malformed. */
export class InvalidOptionError extends LruCacheError {
  public readonly option: string;

  public constructor(option: string, message: string) {
    super(`Invalid option "${option}": ${message}`);
    this.name = "InvalidOptionError";
    this.option = option;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
