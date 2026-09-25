import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUB_DOMAINS, isSubDomain } from '../sub-domains';
import { DEFAULT_POLICIES } from '../defaults';

describe('sub-domain registry', () => {
  it('is mirrored byte-for-byte in the admin portal config', () => {
    const json = JSON.parse(readFileSync(resolve(__dirname, '../../../../../admin-portal/src/config/sub-domains.json'), 'utf8'));
    expect(json).toEqual(SUB_DOMAINS);
  });
  it('covers every sub-domain named in the default policies', () => {
    for (const p of DEFAULT_POLICIES) {
      if (!p.scope?.subDomain) continue;
      for (const sub of p.scope.subDomain.split(',').map((s) => s.trim())) {
        expect(isSubDomain(p.module, sub), `${p.module}/${sub} on "${p.description}"`).toBe(true);
      }
    }
  });
});
