import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { JuviAccount } from '../JuviAccount';
import { MobileSession } from '../MobileSession';
import { ChannelTemplate } from '../ChannelTemplate';
import { Channel } from '../Channel';
import { ChannelMembership } from '../ChannelMembership';
import { JuviProvisioningRun } from '../JuviProvisioningRun';
import { JuviProvisionedCredential } from '../JuviProvisionedCredential';
import { User } from '../../User';
import { College } from '../../College';

const oid = () => new Types.ObjectId();

describe('juvi-app models', () => {
  it('JuviAccount defaults to onboarding with default settings', () => {
    const doc = new JuviAccount({ collegeId: oid(), personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test' });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe('onboarding');
    expect(doc.onboardingStep).toBe(0);
    expect(doc.settings.quietHours).toEqual({ start: '22:00', end: '07:00' });
    expect(doc.settings.tiers).toEqual({ important: true, routine: true });
    expect(doc.settings.language).toBe('en');
  });

  it('JuviAccount rejects a bad kind and a bad quiet-hours string', () => {
    const bad = new JuviAccount({ collegeId: oid(), personId: oid(), userId: oid(), kind: 'parent', provisionedBy: 'test' });
    expect(bad.validateSync()?.errors.kind).toBeDefined();
    const badHours = new JuviAccount({ collegeId: oid(), personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test', settings: { quietHours: { start: '25:00', end: '07:00' } } });
    expect(badHours.validateSync()?.errors['settings.quietHours.start']).toBeDefined();
  });

  it('MobileSession requires device fields and a refresh hash', () => {
    const doc = new MobileSession({ collegeId: oid(), accountId: oid(), userId: oid(), deviceId: 'd1', deviceName: 'Pixel', platform: 'android', appVersion: '1.0.0', osVersion: '14', refreshTokenHash: 'h', refreshExpiresAt: new Date() });
    expect(doc.validateSync()).toBeUndefined();
    const bad = new MobileSession({ collegeId: oid(), accountId: oid(), userId: oid(), deviceId: 'd1', platform: 'windows' });
    expect(bad.validateSync()?.errors.platform).toBeDefined();
  });

  it('MobileSession.previousRefreshTokenHash is optional', () => {
    const doc = new MobileSession({ collegeId: oid(), accountId: oid(), userId: oid(), deviceId: 'd1', deviceName: 'Pixel', platform: 'android', appVersion: '1.0.0', osVersion: '14', refreshTokenHash: 'h', refreshExpiresAt: new Date() });
    expect(doc.validateSync()).toBeUndefined();
    expect(MobileSession.schema.path('previousRefreshTokenHash')).toBeDefined();
  });

  it('Channel carries the full type enum but Channel.type defaults to official', () => {
    const doc = new Channel({ collegeId: oid(), templateCode: 'course', scopeType: 'course_offering', scopeId: oid(), name: 'CS201', about: 'x', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine' });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.type).toBe('official');
    expect(doc.status).toBe('active');
    expect((Channel.schema.path('type') as any).enumValues).toEqual(['official', 'custom', 'dm']);
  });

  it('ChannelMembership defaults role member and joinedVia rule', () => {
    const doc = new ChannelMembership({ collegeId: oid(), channelId: oid(), accountId: oid() });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.role).toBe('member');
    expect(doc.joinedVia).toBe('rule');
  });

  it('ChannelTemplate validates the five codes', () => {
    const doc = new ChannelTemplate({ collegeId: oid(), code: 'hostel', name: 'Hostel', namePattern: '{{block.name}} Hostel', aboutPattern: 'x', scopeType: 'hostel_block', membershipStrategy: 'hostel', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'never' });
    expect(doc.validateSync()).toBeUndefined();
    const bad = new ChannelTemplate({ ...doc.toObject(), code: 'club' });
    expect(bad.validateSync()?.errors.code).toBeDefined();
  });

  it('JuviProvisioningRun and JuviProvisionedCredential validate', () => {
    const run = new JuviProvisioningRun({ collegeId: oid(), filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    expect(run.validateSync()).toBeUndefined();
    expect(run.status).toBe('queued');
    expect(run.counts).toEqual({ scanned: 0, created: 0, existingLinked: 0, skipped: 0, failed: 0 });
    const cred = new JuviProvisionedCredential({ collegeId: oid(), accountId: oid(), source: 'bulk', identifier: '21CS1042', displayName: 'A', ciphertext: Buffer.from('a'), iv: Buffer.from('b'), authTag: Buffer.from('c'), expiresAt: new Date() });
    expect(cred.validateSync()).toBeUndefined();
    expect((JuviProvisionedCredential.schema.path('expiresAt') as any).options.expires).toBe(0);
  });

  it('User gains mustChangePassword defaulting false; College gains juvi defaults', () => {
    const u = new User({ email: 'a@b.c', password: 'x', name: 'A', role: 'student', personaType: 'L-STU' });
    expect(u.mustChangePassword).toBe(false);
    const c = new College({ name: 'X', code: 'X', address: { line1: 'a', city: 'b', state: 'c', pincode: 'd' }, contactEmail: 'a@b.c', contactPhone: '1' });
    expect(c.juvi.enabled).toBe(false);
    expect(c.juvi.quietHoursDefault).toEqual({ start: '22:00', end: '07:00' });
    expect(c.juvi.timezone).toBe('Asia/Kolkata');
  });
});
