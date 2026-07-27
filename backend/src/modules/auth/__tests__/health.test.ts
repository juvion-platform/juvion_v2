import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Regression tests for GET /api/auth/health.
 *
 * The endpoint used to resolve mongoose through `await import('mongoose')`.
 * Under this workspace's CommonJS output that namespace lacks `connection`
 * (it lives on the prototype, which __importStar does not copy), so reading
 * `.readyState` threw. Because it is a bare async Express handler, the
 * rejection went unhandled and took the whole process down on the first
 * request — the health check was a remote kill switch.
 *
 * These assert the two properties that matter: it reports accurately, and it
 * never throws no matter which dependency is unreachable.
 */

const pingMock = vi.fn();

vi.mock('../../../config/redis', () => ({
  default: { ping: (...args: unknown[]) => pingMock(...args) },
}));

import mongoose from 'mongoose';
import { health } from '../controller';

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

let readyStateSpy: ReturnType<typeof vi.spyOn> | undefined;

function setMongoReadyState(value: number) {
  readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get')
    .mockReturnValue(value as never);
}

beforeEach(() => {
  pingMock.mockReset();
});

afterEach(() => {
  readyStateSpy?.mockRestore();
  readyStateSpy = undefined;
});

describe('GET /api/auth/health', () => {
  it('reads the real mongoose connection rather than an empty namespace', () => {
    // The actual bug: this property was undefined via `await import()`.
    // If a future refactor reintroduces a dynamic import, this fails.
    expect(mongoose.connection).toBeDefined();
    expect(typeof mongoose.connection.readyState).toBe('number');
  });

  it('200 ok when both Mongo and Redis are up', async () => {
    setMongoReadyState(1);
    pingMock.mockResolvedValue('PONG');

    const res = mockRes();
    await health({} as Request, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok', mongodb: 'connected', redis: 'connected',
    });
    expect(typeof res.body.uptime).toBe('number');
  });

  it('503 degraded when Redis is unreachable — and does not throw', async () => {
    setMongoReadyState(1);
    pingMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = mockRes();
    await expect(health({} as Request, res)).resolves.toBeUndefined();

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded', mongodb: 'connected', redis: 'disconnected',
    });
  });

  it('503 degraded when Mongo is disconnected', async () => {
    setMongoReadyState(0);
    pingMock.mockResolvedValue('PONG');

    const res = mockRes();
    await health({} as Request, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded', mongodb: 'disconnected', redis: 'connected',
    });
  });

  it('never rejects even if the Mongo probe itself throws', async () => {
    // The precise shape of the original crash: reading connection state blows
    // up. The handler must absorb it, not propagate into an unhandled
    // rejection that terminates the process.
    readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get')
      .mockImplementation(() => { throw new Error('driver exploded'); });
    pingMock.mockResolvedValue('PONG');

    const res = mockRes();
    await expect(health({} as Request, res)).resolves.toBeUndefined();

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', mongodb: 'disconnected' });
  });

  it('never rejects when both dependencies fail', async () => {
    readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get')
      .mockImplementation(() => { throw new Error('driver exploded'); });
    pingMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = mockRes();
    await expect(health({} as Request, res)).resolves.toBeUndefined();

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded', mongodb: 'disconnected', redis: 'disconnected',
    });
  });
});
