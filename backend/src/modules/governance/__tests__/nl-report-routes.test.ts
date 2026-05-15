/**
 * 003-nl-report-queries Task 4.2 — route-level HTTP contract tests.
 *
 * Covers the spec §10.11 status-code-by-scenario table for:
 *   POST /api/governance/reports/nl-query
 *   GET  /api/governance/reports/nl-query/stats
 *
 * Strategy: real express app, real auth middleware (RBAC_ENFORCE=false
 * so authorize() passes through and we test the requireRole gate
 * specifically), service is mocked so the routes/handler/middleware
 * chain is what's under test.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const { nlQueryMock, getStatsMock } = vi.hoisted(() => ({
  nlQueryMock: vi.fn(),
  getStatsMock: vi.fn(),
}));

vi.mock('../nl-reports/service', () => ({
  nlQuery: nlQueryMock,
  getNlReportStats: getStatsMock,
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.RBAC_ENFORCE = 'false';

import request from 'supertest';
import mongoose from 'mongoose';

import { setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import app from '../../../app';
import { createAuthToken } from '../../../__e2e__/factories/user.factory';

const adminCollege = new mongoose.Types.ObjectId().toString();

function adminToken(): string {
  return createAuthToken({
    id: 'admin-user',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    personaType: 'admin',
    collegeId: adminCollege,
  });
}

function hodToken(): string {
  return createAuthToken({
    id: 'hod-user',
    name: 'HOD User',
    email: 'hod@example.com',
    role: 'staff',
    personaType: 'ST-ACAD-HOD',
    collegeId: adminCollege,
  });
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); }, 30_000);

describe('POST /api/governance/reports/nl-query', () => {
  it('401 when no auth header', async () => {
    const res = await request(app).post('/api/governance/reports/nl-query').send({ question: 'q' });
    expect(res.status).toBe(401);
  });

  it('403 when authenticated but role is not admin/super_admin', async () => {
    const res = await request(app)
      .post('/api/governance/reports/nl-query')
      .set('Authorization', `Bearer ${hodToken()}`)
      .set('x-college-id', adminCollege)
      .send({ question: 'september funnel' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/role missing/i);
    expect(nlQueryMock).not.toHaveBeenCalled();
  });

  it('400 when body has no question', async () => {
    const res = await request(app)
      .post('/api/governance/reports/nl-query')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 when question is empty after trim', async () => {
    const res = await request(app)
      .post('/api/governance/reports/nl-query')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege)
      .send({ question: '   ' });
    expect(res.status).toBe(400);
  });

  it('400 when question exceeds 500 chars', async () => {
    const res = await request(app)
      .post('/api/governance/reports/nl-query')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege)
      .send({ question: 'a'.repeat(600) });
    expect(res.status).toBe(400);
  });

  it('200 matched: passes through service response', async () => {
    nlQueryMock.mockResolvedValueOnce({
      status: 'matched',
      reportCode: 'admissions-funnel',
      params: { from: '2026-04-01', to: '2026-04-30' },
      runId: 'run-1',
      results: [],
      rationale: 'r',
      llmModel: 'claude',
      costInr: 0.4,
    });
    const res = await request(app)
      .post('/api/governance/reports/nl-query')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege)
      .send({ question: 'april funnel' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('matched');
    expect(res.body.reportCode).toBe('admissions-funnel');
    expect(nlQueryMock).toHaveBeenCalledWith(adminCollege, 'april funnel', 'Admin User');
  });

  it('200 refused: service-decided refusal still returns 200 (spec §10.11)', async () => {
    nlQueryMock.mockResolvedValueOnce({
      status: 'refused',
      reason: 'no matching report',
      supportedReports: ['admissions-funnel', 'lead-source-performance', 'student-roster-snapshot'],
      llmModel: 'claude',
      costInr: 0.1,
    });
    const res = await request(app)
      .post('/api/governance/reports/nl-query')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege)
      .send({ question: 'show me library overdues' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refused');
    expect(res.body.reason).toBeTruthy();
  });
});

describe('GET /api/governance/reports/nl-query/stats', () => {
  it('401 unauthenticated', async () => {
    const res = await request(app).get('/api/governance/reports/nl-query/stats');
    expect(res.status).toBe(401);
  });

  it('403 wrong role', async () => {
    const res = await request(app)
      .get('/api/governance/reports/nl-query/stats')
      .set('Authorization', `Bearer ${hodToken()}`)
      .set('x-college-id', adminCollege);
    expect(res.status).toBe(403);
  });

  it('200 admin: passes through service response with range defaulting to "today"', async () => {
    getStatsMock.mockResolvedValueOnce({
      range: 'today', totalQueries: 5, matched: 4, refused: 1, llmCostInr: 1.5,
      byReport: [{ reportCode: 'admissions-funnel', count: 4, costInr: 1.4 }],
    });
    const res = await request(app)
      .get('/api/governance/reports/nl-query/stats')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege);
    expect(res.status).toBe(200);
    expect(res.body.totalQueries).toBe(5);
    expect(getStatsMock).toHaveBeenCalledWith(adminCollege, 'today');
  });

  it('accepts ?range=week', async () => {
    getStatsMock.mockResolvedValueOnce({
      range: 'week', totalQueries: 0, matched: 0, refused: 0, llmCostInr: 0, byReport: [],
    });
    const res = await request(app)
      .get('/api/governance/reports/nl-query/stats?range=week')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege);
    expect(res.status).toBe(200);
    expect(getStatsMock).toHaveBeenCalledWith(adminCollege, 'week');
  });

  it('falls back to "today" on an invalid range query', async () => {
    getStatsMock.mockResolvedValueOnce({
      range: 'today', totalQueries: 0, matched: 0, refused: 0, llmCostInr: 0, byReport: [],
    });
    await request(app)
      .get('/api/governance/reports/nl-query/stats?range=year')
      .set('Authorization', `Bearer ${adminToken()}`)
      .set('x-college-id', adminCollege);
    const lastCall = getStatsMock.mock.calls[getStatsMock.mock.calls.length - 1]!;
    expect(lastCall[1]).toBe('today');
  });
});
