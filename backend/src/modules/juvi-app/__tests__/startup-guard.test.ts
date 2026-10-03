import { describe, it, expect } from 'vitest';
import { juviStartupProblems } from '../startup-guard';

const CRED = Buffer.alloc(32, 1).toString('base64');
const RECEIPT = 'r'.repeat(32);
const SA = JSON.stringify({ project_id: 'juvi-test', client_email: 'push@juvi-test.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\n...' });

describe('juviStartupProblems', () => {
  it('requires JUVI_CREDENTIAL_KEY and JUVI_RECEIPT_KEY in production only', () => {
    expect(juviStartupProblems({ NODE_ENV: 'production' })).toEqual([
      'JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)',
      'JUVI_RECEIPT_KEY must be set in production (at least 32 characters)',
    ]);
    expect(juviStartupProblems({ NODE_ENV: 'production', JUVI_CREDENTIAL_KEY: CRED, JUVI_RECEIPT_KEY: RECEIPT })).toEqual([]);
    expect(juviStartupProblems({ NODE_ENV: 'development' })).toEqual([]);
  });
  it('rejects a key of the wrong length anywhere', () => {
    expect(juviStartupProblems({ NODE_ENV: 'development', JUVI_CREDENTIAL_KEY: 'c2hvcnQ=' })).toEqual(['JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes']);
    expect(juviStartupProblems({ NODE_ENV: 'development', JUVI_RECEIPT_KEY: 'short' })).toEqual(['JUVI_RECEIPT_KEY must be at least 32 characters']);
  });
  it('requires Firebase credentials in production only when JUVI_PUSH_REQUIRED=true', () => {
    const prod = { NODE_ENV: 'production', JUVI_CREDENTIAL_KEY: CRED, JUVI_RECEIPT_KEY: RECEIPT };
    expect(juviStartupProblems(prod)).toEqual([]);
    expect(juviStartupProblems({ ...prod, JUVI_PUSH_REQUIRED: 'true' })).toEqual(['FIREBASE_SERVICE_ACCOUNT_JSON must be set when JUVI_PUSH_REQUIRED=true']);
    expect(juviStartupProblems({ ...prod, JUVI_PUSH_REQUIRED: 'true', FIREBASE_SERVICE_ACCOUNT_JSON: SA })).toEqual([]);
  });
  it('rejects Firebase credentials that are not a service-account JSON', () => {
    const problem = 'FIREBASE_SERVICE_ACCOUNT_JSON must be a service-account JSON with project_id, client_email and private_key';
    expect(juviStartupProblems({ NODE_ENV: 'development', FIREBASE_SERVICE_ACCOUNT_JSON: 'not json' })).toEqual([problem]);
    expect(juviStartupProblems({ NODE_ENV: 'development', FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"x"}' })).toEqual([problem]);
  });
});
