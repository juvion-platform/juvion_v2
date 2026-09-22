import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';

/** 010 P2 — bulk user import through the platform door. */
let api: TestApi;
let fx: BaseFixtures;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
  const p = await Person.create({ collegeId: fx.collegeId, name: 'Dr. Import', phone: '9000000999' });
  await Faculty.create({ collegeId: fx.collegeId, personId: p._id, employeeCode: 'IMP01', designation: 'Professor', departmentId: fx.cse._id, contractType: 'regular', status: 'active' });
});
afterAll(cleanupTestApp);

describe('user bulk import', () => {
  it('previews create/create/blocked, commits the valid rows, and the new users can log in', async () => {
    const csv = [
      'email*,name*,personas*,password,employeeCode,rollNumber,isActive',
      'With.Pass@Test.com,With Pass,"f-fac,F-HOD",secret-123,IMP01,,true',
      'nopass@test.com,No Pass,ST-ACC,,,,',
      'bad@test.com,Bad Persona,NOPE,secret-123,,,',
    ].join('\n');

    const up = await api.as(fx.admin.token)
      .post('/api/platform/bulk-imports')
      .field('entityType', 'user')
      .attach('file', Buffer.from(csv), { filename: 'users.csv', contentType: 'text/csv' });
    expect(up.status).toBe(201);
    const job = up.body.job;
    const byRow = (n: number) => job.results.find((r: any) => r.row === n);
    expect(byRow(1).action).toBe('create');
    expect(byRow(1).resolved).toEqual({ Person: 'Employee IMP01' });
    expect(byRow(2).action).toBe('create');
    const tempNote: string = byRow(2).notes.find((n: string) => n.startsWith('temporary password: '));
    const tempPassword = tempNote.replace('temporary password: ', '');
    expect(tempPassword).toHaveLength(12);
    expect(byRow(3).outcome).toBe('blocked');
    expect(byRow(3).notes[0]).toMatch(/Unknown persona/);

    const committed = await api.as(fx.admin.token).post(`/api/platform/bulk-imports/${job._id}/commit`).send({});
    expect(committed.status).toBe(200);
    expect(committed.body.successCount).toBe(2);

    const login1 = await api.post('/api/auth/login').send({ email: 'with.pass@test.com', password: 'secret-123' }).expect(200);
    expect(login1.body.user.personas).toEqual(['F-FAC', 'F-HOD']);
    expect(login1.body.user.role).toBe('hod');
    const login2 = await api.post('/api/auth/login').send({ email: 'nopass@test.com', password: tempPassword }).expect(200);
    expect(login2.body.user.personas).toEqual(['ST-ACC']);
  });

  it('re-upload of an existing email previews as Update and refuses duplicate emails within one file', async () => {
    const csv = [
      'email*,name*,personas*,password,employeeCode,rollNumber,isActive',
      'nopass@test.com,Renamed,ST-REG,,,,',
      'nopass@test.com,Twice,ST-REG,,,,',
    ].join('\n');
    const up = await api.as(fx.admin.token)
      .post('/api/platform/bulk-imports')
      .field('entityType', 'user')
      .attach('file', Buffer.from(csv), { filename: 'users2.csv', contentType: 'text/csv' });
    expect(up.status).toBe(201);
    const rows = up.body.job.results;
    expect(rows.find((r: any) => r.row === 1).action).toBe('update');
    expect(rows.find((r: any) => r.row === 2).outcome).toBe('error');
    expect(rows.find((r: any) => r.row === 2).error).toMatch(/duplicate email/);
  });
});
