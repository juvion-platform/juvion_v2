import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { isOptionalAllotmentEnabled, features } from '../features';

/**
 * T2 (optional-hostel-transport-allotment): feature flag plumbing.
 *
 * The flag is driven by the env var FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS.
 * Only the exact string 'true' enables it; every other value (including
 * 'True', '1', '', and unset) keeps it disabled. This strictness mirrors
 * the spec (“value is read from env var … string 'true' → true,
 * anything else → false”).
 *
 * isOptionalAllotmentEnabled() reads the env var live on each call so tests
 * can flip the flag without having to re-import the module.
 */

const ENV_KEY = 'FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS';
const originalValue = process.env[ENV_KEY];

function setFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = value;
  }
}

beforeEach(() => {
  // Ensure every test starts from a clean slate.
  delete process.env[ENV_KEY];
});

afterAll(() => {
  // Restore whatever the test runner started with.
  if (originalValue === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalValue;
  }
});

describe('isOptionalAllotmentEnabled()', () => {
  it("returns true when env var is exactly 'true'", () => {
    setFlag('true');
    expect(isOptionalAllotmentEnabled()).toBe(true);
  });

  it('returns false when env var is unset', () => {
    expect(isOptionalAllotmentEnabled()).toBe(false);
  });

  it("returns false when env var is 'false'", () => {
    setFlag('false');
    expect(isOptionalAllotmentEnabled()).toBe(false);
  });

  it("returns false for 'True' (case-sensitive per spec)", () => {
    setFlag('True');
    expect(isOptionalAllotmentEnabled()).toBe(false);
  });

  it("returns false for '1' (spec requires the literal string 'true')", () => {
    setFlag('1');
    expect(isOptionalAllotmentEnabled()).toBe(false);
  });

  it('returns false for an empty string', () => {
    setFlag('');
    expect(isOptionalAllotmentEnabled()).toBe(false);
  });

  it('reacts to env var changes at runtime (no re-import required)', () => {
    setFlag('true');
    expect(isOptionalAllotmentEnabled()).toBe(true);
    setFlag(undefined);
    expect(isOptionalAllotmentEnabled()).toBe(false);
    setFlag('true');
    expect(isOptionalAllotmentEnabled()).toBe(true);
  });
});

describe('features object', () => {
  it('exposes optionalAllotmentProposals as a boolean matching the helper', () => {
    setFlag('true');
    expect(features.optionalAllotmentProposals).toBe(true);
    setFlag('false');
    expect(features.optionalAllotmentProposals).toBe(false);
    setFlag(undefined);
    expect(features.optionalAllotmentProposals).toBe(false);
  });

  it('exposes a typed boolean (compile-time; runtime typeof check)', () => {
    setFlag('true');
    expect(typeof features.optionalAllotmentProposals).toBe('boolean');
  });
});
