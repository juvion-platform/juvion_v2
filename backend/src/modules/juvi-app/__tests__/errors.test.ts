import { describe, it, expect, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { MobileApiError, mobileErrorHandler, notFound } from '../errors';
import { AppError } from '../../../middleware/errorHandler';

function mockRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

describe('mobile error envelope', () => {
  it('renders MobileApiError with code, message and detail fields spread', () => {
    const res = mockRes();
    mobileErrorHandler(new MobileApiError(429, 'COOLDOWN', 'Wait', { retryAfterSeconds: 540 }), {} as any, res, vi.fn());
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: { code: 'COOLDOWN', message: 'Wait', retryAfterSeconds: 540 } });
  });

  it('a detail.message or detail.code never overrides the envelope code and message', () => {
    const res = mockRes();
    mobileErrorHandler(new MobileApiError(503, 'INSTITUTION_PAUSED', 'Top', { message: 'From detail', code: 'INTERNAL', extra: 1 }), {} as any, res, vi.fn());
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: { code: 'INSTITUTION_PAUSED', message: 'Top', extra: 1 } });
  });

  it('maps ZodError to VALIDATION_FAILED with paths but never values', () => {
    const res = mockRes();
    const err = (() => { try { z.object({ password: z.string().min(8) }).parse({ password: 'short' }); } catch (e) { return e as ZodError; } })()!;
    mobileErrorHandler(err, {} as any, res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields).toEqual([{ path: 'password', message: expect.any(String) }]);
    expect(JSON.stringify(res.body)).not.toContain('short');
  });

  it('maps a plain AppError to the envelope by status', () => {
    const res = mockRes();
    mobileErrorHandler(new AppError(404, 'Widget not found'), {} as any, res, vi.fn());
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Widget not found' } });
  });

  it('maps plain AppError with unmapped status code to INTERNAL', () => {
    const res = mockRes();
    mobileErrorHandler(new AppError(503, 'AWS_S3_BUCKET not configured'), {} as any, res, vi.fn());
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: { code: 'INTERNAL', message: 'AWS_S3_BUCKET not configured' } });
  });

  it('hides unknown errors behind INTERNAL', () => {
    const res = mockRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mobileErrorHandler(new Error('db exploded'), {} as any, res, vi.fn());
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    spy.mockRestore();
  });

  it('notFound helper builds a 404', () => {
    const e = notFound('Channel');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toBe('Channel not found');
  });
});
