/**
 * The fallback boundary for bundled public content.
 *
 * `src/domain/fixtures.ts` carries in-repo copies of a few labs and techniques so the app still
 * renders when the public resources are genuinely unreachable — an offline load, a missing deploy,
 * a test environment with no static server. That fallback must never stand in for *wrong* public
 * content: substituting a fixture for a lab whose JSON fails validation, references a missing
 * technique, or pins the wrong version would hide the very errors the content checker exists to
 * surface, and would ship a lab nobody edited.
 *
 * So loaders classify every failure exactly once:
 *
 *   - `BundleResourceError` — the bytes could not be obtained (network failure, non-OK status,
 *     unparseable JSON). Falling back to a fixture is legitimate.
 *   - `BundleContentError` — the bytes arrived and are wrong (schema, reference, version, id
 *     mismatch). The error surfaces to the caller; no fixture may mask it.
 */

export class BundleResourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BundleResourceError";
  }
}

export class BundleContentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BundleContentError";
  }
}

export const isBundleResourceError = (error: unknown): error is BundleResourceError =>
  error instanceof BundleResourceError;
