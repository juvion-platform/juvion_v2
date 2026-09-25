import { describe, it, expect, vi } from 'vitest';
const calls = vi.hoisted(() => [] as string[]);
vi.mock('../../../../middleware/authorize', () => ({ authorize: (m: string, a: string) => { calls.push(`${m}:${a}`); return (_q: unknown, _s: unknown, n: () => void) => n(); } }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_q: unknown, _s: unknown, n: () => void) => n() }));
import { adminRouter } from '../routes';

describe('admin routes declare the spec permissions', () => {
  it('uses platform:create for run creation and CSV export; platform:update for mutations', () => {
    expect(adminRouter).toBeDefined();
    // Only 2 platform:create routes exist until Task 3 adds reveal-credential, which raises this to 3.
    expect(calls.filter((c) => c === 'platform:create').length).toBeGreaterThanOrEqual(2);
    expect(calls).toContain('platform:update');
    expect(calls).toContain('platform:read');
    expect(calls.every((c) => c.startsWith('platform:'))).toBe(true);
  });
});
