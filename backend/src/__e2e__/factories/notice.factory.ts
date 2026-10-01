import type { Express } from 'express';
import { Person, Staff, Department } from '../../models';
import { User } from '../../models/User';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { Notice, LeanNotice } from '../../models/juvi/Notice';
import { drainOutbox } from '../../shared/outbox';
import type { BaseFixtures } from '../setup/seed-base';
import { createTestUser, createAuthToken } from './user.factory';
import { createTestFaculty } from './academic.factory';
import { mobileClient, TEST_DEVICE } from './juvi.factory';
import { transitionAccount } from '../../modules/juvi-app/accounts/provisioning-service';
import { resolvePublisherScope, ErpUserRef } from '../../modules/juvi-app/notices/publisher-scope';
import { publishNotice } from '../../modules/juvi-app/notices/publish-service';
import { publishSchema } from '../../modules/juvi-app/notices/admin-schemas';

let staffCounter = 0;

export function erpRef(user: { _id: unknown; role: string; personaType: string; personas?: string[] }): ErpUserRef {
  return { id: String(user._id), role: user.role, personaType: user.personaType, personas: user.personas ?? [user.personaType] };
}

export function adminRef(fx: BaseFixtures): ErpUserRef {
  return erpRef(fx.admin.user);
}

/** Moves an account to `active` through the real transition (which back-fills recipient rows from Task 10 on). */
export async function activateAccount(accountId: string): Promise<void> {
  const account = await JuviAccount.findById(accountId);
  if (!account) throw new Error(`No account ${accountId}`);
  await transitionAccount(account, 'active', 'admin', 'test');
}

/** A staff member with an ERP login holding `personaCode` (e.g. ST-EXAM). */
export async function createStaffPublisher(fx: BaseFixtures, personaCode: string) {
  staffCounter += 1;
  const person = await Person.create({ collegeId: fx.collegeId, name: `${personaCode} Officer ${staffCounter}`, phone: `96000${String(staffCounter).padStart(5, '0')}` });
  const staff = await Staff.create({ collegeId: fx.collegeId, personId: person._id, employeeCode: `STF${String(staffCounter).padStart(4, '0')}`, designation: 'Officer', staffType: 'administrative', personaCode, status: 'active' });
  const { user, token } = await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: personaCode, name: person.name, email: `staff${staffCounter}@test.com`, personId: String(person._id) });
  return { person, staff, user, token };
}

/** A faculty member who heads `department`, with an HOD login. */
export async function makeHod(fx: BaseFixtures, department: { _id: unknown }) {
  const f = await createTestFaculty(fx.collegeId, { departmentId: String(department._id) });
  await Department.updateOne({ _id: department._id, collegeId: fx.collegeId }, { $set: { hodId: f.faculty._id } });
  await User.updateOne({ _id: f.user._id }, { $set: { role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'] } });
  const user = (await User.findById(f.user._id))!;
  const token = createAuthToken({ id: String(user._id), name: user.name, email: user.email, role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'], tv: user.tokenVersion, collegeId: fx.collegeId });
  return { person: f.person, faculty: f.faculty, user, token };
}

/** Publishes through the service as `publisher` (default: the college admin) and waits for the fan-out. */
export async function publishTestNotice(fx: BaseFixtures, overrides: Record<string, unknown> = {}, publisher: ErpUserRef = adminRef(fx)): Promise<LeanNotice> {
  const input = publishSchema.parse({
    title: 'Exam timetable', body: 'The mid-semester timetable is attached.',
    audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] },
    ...overrides,
  });
  const scope = await resolvePublisherScope(fx.collegeId, publisher, input.office);   // the office override only applies to admins
  const notice = await publishNotice(fx.collegeId, scope, input, 'test');
  await drainOutbox();
  return (await Notice.findById(notice._id).lean<LeanNotice>())!;
}

export async function signInAs(app: Express, fx: BaseFixtures, identifier: string, password: string, deviceId = TEST_DEVICE.id): Promise<string> {
  const res = await mobileClient(app).post('/api/juvi-app/v1/auth/sign-in')
    .send({ collegeId: fx.collegeId, identifier, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}
