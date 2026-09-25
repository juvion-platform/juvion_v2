import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { Person, Student, Section } from '../../models';
import { JuviProvisioningRun } from '../../models/juvi/JuviProvisioningRun';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { AuditLog } from '../../shared/audit';
import { runProvisioningJob } from '../../modules/juvi-app/accounts/provisioning-worker';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function studentNoUser(roll: string, sectionId?: unknown) {
  const person = await Person.create({ collegeId: fx.collegeId, name: `S ${roll}`, phone: `9${roll.replace(/\D/g, '').padStart(9, '0')}` });
  const s = await Student.create({ collegeId: fx.collegeId, personId: person._id, admissionYear: 2024, rollNumber: roll, status: 'active', batchId: fx.batch._id, branchId: fx.cseBranch._id, programmeId: fx.btech._id });
  if (sectionId) await Section.updateOne({ _id: sectionId }, { $addToSet: { studentIds: s._id } });
  return s;
}

/** Wait for the inline fallback (no Redis in tests) to finish the run. */
async function settled(runId: string) {
  for (let i = 0; i < 50; i++) {
    const r = await JuviProvisioningRun.findById(runId).lean();
    if (r && ['completed', 'partial', 'failed'].includes(r.status)) return r;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error('run did not settle');
}

describe('provisioning runs', () => {
  it('POST creates a run (202), which completes; GET lists and fetches it', async () => {
    await studentNoUser('24C001', fx.cseSection._id);
    await studentNoUser('24C002');
    const created = await api.as(fx.admin.token).post(`${A}/provisioning/runs`).send({ kinds: ['student'], batchIds: [String(fx.batch._id)] }).expect(202);
    expect(created.body.status).toMatch(/queued|running|completed/);
    const run = await settled(created.body._id);
    expect(run.counts).toMatchObject({ scanned: 2, created: 2 });
    const list = await api.as(fx.admin.token).get(`${A}/provisioning/runs`).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.total).toBe(1);
    const one = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${created.body._id}`).expect(200);
    expect(one.body.performedBy).toBe('College Admin');
    await api.as(fx.admin.token).post(`${A}/provisioning/runs`).send({ kinds: [] }).expect(400);
  }, 15_000);

  it('credential groups and CSV export by section, audited; 410 once expired', async () => {
    await studentNoUser('24D001', fx.cseSection._id);
    await studentNoUser('24D002', fx.cseSection._id);
    await studentNoUser('24D003');
    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    await runProvisioningJob(String(run._id));

    const groups = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}/credential-groups`).expect(200);
    expect(groups.body.live).toBe(true);
    expect(groups.body.groups).toEqual(expect.arrayContaining([
      { key: 'section', id: String(fx.cseSection._id), label: 'Section A', count: 2 },
      { key: 'none', id: null, label: 'No section', count: 1 },
    ]));

    const csv = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}/credentials.csv?sectionId=${fx.cseSection._id}`).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/attachment; filename="juvi-credentials-/);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe('identifier,name,section,temporaryPassword,institutionCode');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^24D00[12],S 24D00[12],A,[a-z]+-[a-z]+-\d{3},JIT-TEST$/);
    expect(await AuditLog.countDocuments({ entityType: 'JuviProvisioningRun', entityId: String(run._id), action: 'update' })).toBe(1);

    await JuviProvisionedCredential.deleteMany({ runId: run._id });   // simulate TTL expiry
    const gone = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}/credentials.csv`).expect(410);
    expect(gone.body.error).toMatch(/expired/i);
  });

  it('reads are allowed for any platform reader (RBAC is a pass-through in this harness)', async () => {
    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    // The route-level authorize actions are pinned by the unit test in Step 3, not here.
    await api.as(fx.principal.token).get(`${A}/provisioning/runs/${run._id}/credential-groups`).expect(200);
  });

  it('another college cannot see the run', async () => {
    const run = await JuviProvisioningRun.create({ collegeId: '000000000000000000000099', filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'x' });
    await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}`).expect(404);
  });
});
