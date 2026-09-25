import supertest from 'supertest';
import type { Express } from 'express';
import { College, IJuviConfig } from '../../models/College';
import { Person, Student, Section } from '../../models';
import { createTestStudent } from './student.factory';
import { createTestFaculty } from './academic.factory';
import type { BaseFixtures } from '../setup/seed-base';
import { provisionPerson } from '../../modules/juvi-app/accounts/provisioning-service';
import { revealLatestForAccount } from '../../modules/juvi-app/accounts/credential-store';
import { invalidateJuviConfig } from '../../modules/juvi-app/config/institution-config';
import type { DeviceInfo } from '../../modules/juvi-app/accounts/session-service';

export const TEST_DEVICE: DeviceInfo = { id: 'device-1', name: 'Test Phone', platform: 'android', appVersion: '1.0.0', osVersion: '14' };

export async function enableJuvi(collegeId: string, patch: Partial<IJuviConfig> = {}): Promise<void> {
  const set: Record<string, unknown> = { 'juvi.enabled': true };
  for (const [k, v] of Object.entries(patch)) set[`juvi.${k}`] = v;
  await College.updateOne({ _id: collegeId }, { $set: set });
  await invalidateJuviConfig(collegeId);
}

let noLoginStudentCounter = 0;

export async function provisionTestStudent(
  fx: BaseFixtures,
  opts: { sectionId?: string; batchId?: string; branchId?: string; withUser?: boolean } = {},
) {
  const withUser = opts.withUser ?? true;
  const batchId = opts.batchId ?? String(fx.batch._id);
  const branchId = opts.branchId ?? String(fx.cseBranch._id);

  let person;
  let student;
  if (withUser) {
    const s = await createTestStudent(fx.collegeId, { batchId, branchId, programmeId: String(fx.btech._id) });
    person = s.person;
    student = s.student;
  } else {
    // No pre-existing login: only Person + Student rows, so provisionPerson
    // must create the User itself (mirrors the "student with no login" case).
    noLoginStudentCounter++;
    person = await Person.create({
      collegeId: fx.collegeId,
      name: `No Login Student ${noLoginStudentCounter}`,
      phone: `97000${String(noLoginStudentCounter).padStart(5, '0')}`,
    });
    student = await Student.create({
      collegeId: fx.collegeId,
      personId: person._id,
      admissionYear: 2024,
      rollNumber: `NOLOGIN${String(noLoginStudentCounter).padStart(4, '0')}`,
      status: 'active',
      batchId,
      branchId,
    });
  }

  if (opts.sectionId) await Section.updateOne({ _id: opts.sectionId }, { $addToSet: { studentIds: student._id } });
  const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(person._id), kind: 'student', source: 'admin', performedBy: 'test' });
  const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
  return { person, student, account, tempPassword: cred!.password };
}

export async function provisionTestFaculty(fx: BaseFixtures, opts: { departmentId?: string } = {}) {
  const f = await createTestFaculty(fx.collegeId, { departmentId: opts.departmentId ?? String(fx.cse._id) });
  const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(f.person._id), kind: 'faculty', source: 'admin', performedBy: 'test' });
  const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
  return { ...f, account, tempPassword: cred!.password };
}

/** supertest wrapper that sends the mobile headers. */
export function mobileClient(app: Express, accessToken?: string) {
  const agent = supertest(app);
  const decorate = (r: supertest.Test) => {
    r.set('X-Juvi-App-Version', TEST_DEVICE.appVersion).set('X-Juvi-Platform', TEST_DEVICE.platform).set('X-Juvi-Device-Id', TEST_DEVICE.id);
    if (accessToken) r.set('Authorization', `Bearer ${accessToken}`);
    return r;
  };
  return {
    get: (url: string) => decorate(agent.get(url)),
    post: (url: string) => decorate(agent.post(url)),
    patch: (url: string) => decorate(agent.patch(url)),
    put: (url: string) => decorate(agent.put(url)),
    delete: (url: string) => decorate(agent.delete(url)),
  };
}
