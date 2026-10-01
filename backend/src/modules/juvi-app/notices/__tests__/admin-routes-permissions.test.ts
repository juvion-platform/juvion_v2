import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../middleware/authorize', () => ({
  authorize: (m: string, a: string) => Object.assign((_q: unknown, _s: unknown, n: () => void) => n(), { perm: `${m}:${a}` }),
}));
import { noticesAdminRouter } from '../admin-routes';

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: { perm?: string } }[] } };

describe('admin notices routes declare the spec §7.2 permissions', () => {
  it('maps every route to notices:read, create or update', () => {
    const perms: Record<string, string> = {};
    for (const layer of (noticesAdminRouter as unknown as { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      const method = Object.keys(layer.route.methods)[0]!.toUpperCase();
      perms[`${method} ${layer.route.path}`] = layer.route.stack.map((s) => s.handle.perm).find(Boolean) ?? 'none';
    }
    expect(perms).toEqual({
      'GET /': 'notices:read',
      'GET /targets': 'notices:create',
      'GET /dead-events': 'notices:read',
      'GET /:id': 'notices:read',
      'GET /:id/reach': 'notices:read',
      'GET /:id/reach/pending': 'notices:read',
      'GET /:id/reach.csv': 'notices:read',
      'GET /:id/audit': 'notices:read',
      'POST /attachments': 'notices:create',
      'POST /audience-preview': 'notices:create',
      'POST /': 'notices:create',
      'POST /:id/remind': 'notices:update',
      'POST /:id/archive': 'notices:update',
      'POST /:id/retry-delivery': 'notices:update',
    });
  });
});
