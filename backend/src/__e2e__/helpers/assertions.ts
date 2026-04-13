import { expect } from 'vitest';

/**
 * Assert that a response body has the standard paginated shape.
 */
export function expectPaginated(body: Record<string, unknown>, opts?: { minItems?: number }) {
  expect(body).toHaveProperty('items');
  expect(body).toHaveProperty('total');
  expect(body).toHaveProperty('page');
  expect(body).toHaveProperty('pages');
  expect(Array.isArray(body.items)).toBe(true);
  if (opts?.minItems !== undefined) {
    expect((body.items as unknown[]).length).toBeGreaterThanOrEqual(opts.minItems);
  }
}

/**
 * Assert a response body has an error field.
 */
export function expectError(body: Record<string, unknown>) {
  expect(body).toHaveProperty('error');
}

/**
 * Assert entity shape: _id, createdAt, updatedAt.
 */
export function expectEntity(body: Record<string, unknown>) {
  expect(body).toHaveProperty('_id');
  expect(body).toHaveProperty('createdAt');
  expect(body).toHaveProperty('updatedAt');
}
