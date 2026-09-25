import { describe, it, expect } from 'vitest';
import { juviStartupProblems } from '../startup-guard';

describe('juviStartupProblems', () => {
  it('requires JUVI_CREDENTIAL_KEY in production only', () => {
    expect(juviStartupProblems({ NODE_ENV: 'production' })).toEqual(['JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)']);
    expect(juviStartupProblems({ NODE_ENV: 'production', JUVI_CREDENTIAL_KEY: Buffer.alloc(32, 1).toString('base64') })).toEqual([]);
    expect(juviStartupProblems({ NODE_ENV: 'development' })).toEqual([]);
  });
  it('rejects a key of the wrong length anywhere', () => {
    expect(juviStartupProblems({ NODE_ENV: 'development', JUVI_CREDENTIAL_KEY: 'c2hvcnQ=' })).toEqual(['JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes']);
  });
});
