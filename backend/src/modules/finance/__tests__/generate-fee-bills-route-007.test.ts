/**
 * 007 · T5 — generate-from-pins endpoint (schema + controller wiring).
 *
 * The service behaviour is covered by fee-billing-service-007 (T3/T4). Here we lock in
 * the HTTP seam: the zod schema accepts/rejects the right shapes, and the controller
 * forwards (collegeId, body, who) to the batch service and returns 201 with its result.
 * The `finance:create` gate is applied declaratively on the route (routes.ts) and is
 * exercised centrally by the RBAC suite + e2e, per finance-module convention.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, vi } from 'vitest';

// The controller import graph reaches fee-pin-service → the commitment worker; mock it
// so no BullMQ/Redis connection is attempted at import time.
vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));
vi.mock('../fee-billing-service', async () => {
  const actual = await vi.importActual<typeof import('../fee-billing-service')>('../fee-billing-service');
  return { ...actual, generateSemesterInstallmentsForPinned: vi.fn() };
});

import { generateFeeBillsSchema } from '../validation';
import * as feeBillingService from '../fee-billing-service';
import { generateFeeBillsCtrl } from '../controller';

describe('007 T5 — generateFeeBillsSchema', () => {
  it('accepts a minimal body (semesterId only)', () => {
    expect(generateFeeBillsSchema.safeParse({ semesterId: 'sem1' }).success).toBe(true);
  });
  it('accepts a full body', () => {
    expect(generateFeeBillsSchema.safeParse({
      semesterId: 'sem1', studentIds: ['a', 'b'], yearOfStudy: 3, dryRun: true,
    }).success).toBe(true);
  });
  it('rejects an empty semesterId', () => {
    expect(generateFeeBillsSchema.safeParse({ semesterId: '' }).success).toBe(false);
  });
  it('rejects an out-of-range yearOfStudy', () => {
    expect(generateFeeBillsSchema.safeParse({ semesterId: 'sem1', yearOfStudy: 9 }).success).toBe(false);
  });

  // An empty array previously passed validation, then failed the `length > 0`
  // check in the service and fell through to billing EVERY pinned student in
  // the college. The console disables Generate on an empty selection too, so
  // the mass-bill path is closed at both ends.
  it('rejects an empty studentIds array — never reads as "everyone"', () => {
    expect(generateFeeBillsSchema.safeParse({ semesterId: 'sem1', studentIds: [] }).success).toBe(false);
  });

  it('accepts the axis filters and coerces dueDate to a Date', () => {
    const parsed = generateFeeBillsSchema.safeParse({
      semesterId: 'sem1', programmeId: 'prog1', branchId: 'br1', dueDate: '2026-09-15',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.dueDate).toBeInstanceOf(Date);
  });

  // Colleges legitimately raise a bill whose deadline has already passed.
  it('accepts a dueDate in the past', () => {
    expect(generateFeeBillsSchema.safeParse({ semesterId: 'sem1', dueDate: '2020-01-01' }).success).toBe(true);
  });
});

describe('007 T5 — generateFeeBillsCtrl', () => {
  it('forwards (collegeId, body, who) to the batch service and returns 201', async () => {
    const result = { dryRun: false, generated: 3, alreadyBilled: 0, noPin: 1, pinnedToDifferentAy: 0, noAmount: 0, unsupportedSemesterNumber: 0, errors: [], rows: [], totalAmount: 180000 };
    vi.mocked(feeBillingService.generateSemesterInstallmentsForPinned).mockResolvedValue(result);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const req = { collegeId: 'college-1', body: { semesterId: 'sem1', dryRun: false }, user: { name: 'Admin' } } as never;
    const res = { status } as never;
    const next = vi.fn();

    await generateFeeBillsCtrl(req, res, next);

    expect(feeBillingService.generateSemesterInstallmentsForPinned)
      .toHaveBeenCalledWith('college-1', { semesterId: 'sem1', dryRun: false }, 'Admin');
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes service errors to next()', async () => {
    const err = new Error('boom');
    vi.mocked(feeBillingService.generateSemesterInstallmentsForPinned).mockRejectedValue(err);
    const req = { collegeId: 'c1', body: { semesterId: 'sem1' }, user: undefined } as never;
    const res = { status: vi.fn(() => ({ json: vi.fn() })) } as never;
    const next = vi.fn();
    await generateFeeBillsCtrl(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

/**
 * Source-order guard, in the spirit of aggregate-collegeid-pattern.test.ts.
 *
 * Express matches routes in declaration order. `GET /invoices/billing-history`
 * registered AFTER `GET /invoices/:id` would be swallowed as an :id and handed
 * to getInvoice, failing as an ObjectId cast error that looks nothing like a
 * routing bug. Only ordering prevents it, so only ordering can be asserted.
 */
describe('billing-history route registration', () => {
  it('is declared before /invoices/:id', () => {
    const src = readFileSync(
      join(__dirname, '..', 'routes.ts'),
      'utf8',
    );
    const history = src.indexOf("router.get('/invoices/billing-history'");
    const byId = src.indexOf("router.get('/invoices/:id'");

    expect(history).toBeGreaterThan(-1);
    expect(byId).toBeGreaterThan(-1);
    expect(history).toBeLessThan(byId);
  });

  it('is gated finance:create, matching the console that is its only caller', () => {
    const src = readFileSync(join(__dirname, '..', 'routes.ts'), 'utf8');
    const line = src.split('\n').find((l) => l.includes("'/invoices/billing-history'"));
    expect(line).toContain("authorize('finance', 'create')");
  });
});
