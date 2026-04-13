import supertest from 'supertest';
import type { Express } from 'express';

/**
 * Wraps supertest with auth convenience methods.
 *
 * Usage:
 *   const api = createTestApi(app);
 *   await api.get('/api/health').expect(200);
 *   await api.as(adminToken).get('/api/people/students').expect(200);
 */
export function createTestApi(app: Express) {
  const agent = supertest(app);

  function withAuth(token: string) {
    return {
      get: (url: string) => agent.get(url).set('Authorization', `Bearer ${token}`),
      post: (url: string) => agent.post(url).set('Authorization', `Bearer ${token}`),
      put: (url: string) => agent.put(url).set('Authorization', `Bearer ${token}`),
      delete: (url: string) => agent.delete(url).set('Authorization', `Bearer ${token}`),
    };
  }

  return {
    get: (url: string) => agent.get(url),
    post: (url: string) => agent.post(url),
    put: (url: string) => agent.put(url),
    delete: (url: string) => agent.delete(url),
    as: withAuth,
  };
}

export type TestApi = ReturnType<typeof createTestApi>;
