# Juvi Foundation — Plan 1 of 3: Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `juvi-app` backend module: per-device mobile sessions, account provisioning with an encrypted credential store, channel templates with reconciled membership, the v1 mobile API, the OpenAPI contract, and the two background workers, so a Flutter client (Plan 3) and the admin console (Plan 2) have a complete, tested server to build on.

**Architecture:** A new Express module at `backend/src/modules/juvi-app/` mounted at `/api/juvi-app` with its own `authenticateMobile` middleware and error envelope. Models live in `backend/src/models/juvi/`. Membership is computed by pure strategy functions over an in-memory `ErpGraph` that two loaders populate (whole college, or one account), so one algorithm serves both the five-minute college pass and the per-sign-in account pass. Nothing under the existing `modules/juvi` AI module changes.

**Tech Stack:** Express 4, Mongoose 8, Zod 3, BullMQ 5, ioredis 5, jsonwebtoken 9, bcryptjs, Node `crypto`, `@asteasolutions/zod-to-openapi` 7, vitest 4, supertest, mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` (§7 data model, §8 auth, §9 provisioning and reconciliation, §10 API, §13 self-scope fix, §14 failure handling, §16 testing, §17 configuration).

## Global Constraints

- Every new model has `collegeId: { type: Schema.Types.ObjectId, required: true, index: true }` and every query filters by `collegeId` (CLAUDE.md multi-tenancy rule).
- `AppError` takes `(statusCode, message, detail?)` — status code first. `MobileApiError` extends it.
- TypeScript strict: `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`. Prefix unused params with `_`.
- Use `String(doc._id)` to stringify ObjectIds.
- Unit tests live in `__tests__/` beside the code and run with `npm run test -w backend` (vitest, no DB). Integration tests live in `backend/src/__e2e__/modules/` and run with `npm run test:e2e -w backend` (mongodb-memory-server, `RBAC_ENFORCE=false`, `JWT_SECRET=test-secret`, `NODE_ENV=test`).
- Redis is optional at runtime: every Redis call in this module is wrapped so a connection failure degrades (session check falls back to Mongo, cooldown allows, reconcile scheduling warns) rather than throws (spec §14).
- Access token TTL 900 s. Refresh token TTL 90 days. Session revocation cache key `juvi:sess:{sid}`; active cached 60 s, revoked cached 900 s.
- Cooldown: 5 failures per 10 minutes per `(collegeId, sha256(identifier.toLowerCase()))`, key `juvi:login-fail:{cid}:{hash}`.
- Temporary password format: `word-word-NNN`, two words from a 2,048-word list plus a three-digit number.
- Placeholder email: `{identifier}@no-email.{collegecode}.juvion.invalid`, lowercased.
- Mobile API prefix `/api/juvi-app/v1`. Admin prefix `/api/juvi-app/admin` (Plan 2).
- Error envelope: `{ "error": { "code": "<CODE>", "message": "<text>", ...detail } }`. Codes: VALIDATION_FAILED 400, INVALID_CREDENTIALS 401, TOKEN_EXPIRED 401, SESSION_INVALIDATED 401, ACCOUNT_DEACTIVATED 403, FORBIDDEN 403, NOT_FOUND 404, GONE 410, UPDATE_REQUIRED 426, COOLDOWN 429, INTERNAL 500, INSTITUTION_PAUSED 503.
- Headers read by the mobile middleware: `Authorization: Bearer`, `X-Juvi-App-Version`, `X-Juvi-Platform`, `X-Juvi-Device-Id`.
- Onboarding steps, server-owned: `['identity', 'spaces', 'notifications']`.
- New env vars: `JUVI_CREDENTIAL_KEY` (32-byte base64, required in production), `JUVI_RECONCILE_INTERVAL_MINUTES` (default `5`).
- Commit after every task with a conventional-commit message ending in the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

**Create**

```
backend/src/models/juvi/JuviAccount.ts               account + transitions + settings
backend/src/models/juvi/MobileSession.ts             per-device session, hashed refresh token
backend/src/models/juvi/ChannelTemplate.ts           five seeded templates per college
backend/src/models/juvi/Channel.ts                   one channel per ERP scope object
backend/src/models/juvi/ChannelMembership.ts         account ↔ channel with role + mute
backend/src/models/juvi/JuviProvisioningRun.ts       bulk-run bookkeeping
backend/src/models/juvi/JuviProvisionedCredential.ts encrypted temp passwords, TTL 7 days
backend/src/models/juvi/__tests__/juvi-app-models.schema.test.ts

backend/src/modules/juvi-app/index.ts                exports router
backend/src/modules/juvi-app/routes.ts               mounts /v1 sub-routers + error handler
backend/src/modules/juvi-app/errors.ts               MobileApiError, mobileErrorHandler
backend/src/modules/juvi-app/middleware/authenticate-mobile.ts
backend/src/modules/juvi-app/middleware/rate-limits.ts
backend/src/modules/juvi-app/config/institution-config.ts   getJuviConfig, isJuviEnabled, version compare
backend/src/modules/juvi-app/config/schemas.ts
backend/src/modules/juvi-app/config/controller.ts
backend/src/modules/juvi-app/config/routes.ts
backend/src/modules/juvi-app/accounts/temp-password.ts
backend/src/modules/juvi-app/accounts/wordlist.ts     generated, 2,048 words
backend/src/modules/juvi-app/accounts/credential-store.ts
backend/src/modules/juvi-app/accounts/cooldown.ts
backend/src/modules/juvi-app/accounts/identifier-resolver.ts
backend/src/modules/juvi-app/accounts/session-service.ts
backend/src/modules/juvi-app/accounts/provisioning-service.ts
backend/src/modules/juvi-app/accounts/provisioning-worker.ts
backend/src/modules/juvi-app/accounts/auth-service.ts
backend/src/modules/juvi-app/accounts/me-service.ts
backend/src/modules/juvi-app/accounts/schemas.ts
backend/src/modules/juvi-app/accounts/auth-controller.ts
backend/src/modules/juvi-app/accounts/me-controller.ts
backend/src/modules/juvi-app/accounts/routes.ts
backend/src/modules/juvi-app/spaces/templates.ts      DEFAULT_CHANNEL_TEMPLATES, renderPattern
backend/src/modules/juvi-app/spaces/strategies.ts     ErpGraph types + computeExpectedMembers (pure)
backend/src/modules/juvi-app/spaces/graph-loader.ts   loadCollegeGraph, loadAccountGraph
backend/src/modules/juvi-app/spaces/reconcile-service.ts
backend/src/modules/juvi-app/spaces/reconcile-worker.ts
backend/src/modules/juvi-app/spaces/next-class.ts
backend/src/modules/juvi-app/spaces/spaces-service.ts
backend/src/modules/juvi-app/spaces/schemas.ts
backend/src/modules/juvi-app/spaces/controller.ts
backend/src/modules/juvi-app/spaces/routes.ts
backend/src/modules/juvi-app/openapi/document.ts     registry of every v1 path
backend/src/modules/juvi-app/openapi/generate.ts     writes mobile/api/openapi.json
backend/src/shared/seed/channel-templates.ts
backend/src/__e2e__/factories/juvi.factory.ts        provisionTestAccount, signInTestAccount
mobile/api/openapi.json                              committed contract
.github/workflows/contract.yml
```

**Modify**

```
backend/src/models/User.ts                mustChangePassword, passwordChangedAt
backend/src/models/College.ts             juvi sub-document
backend/src/models/index.ts               export the seven models
backend/src/shared/rbac/types.ts          AuthScope.studentId
backend/src/shared/rbac/scope-resolver.ts resolve studentId for students
backend/src/shared/rbac/apply-scope.ts    use studentId when selfField is studentId
backend/src/shared/queue/QueueManager.ts  QUEUE_NAMES.JUVI_PROVISIONING, JUVI_RECONCILE
backend/src/server.ts                     register the two workers
backend/src/app.ts                        mount /api/juvi-app, JUVI_CREDENTIAL_KEY guard
backend/src/modules/admissions/workflow.handlers.ts   W01 provision_m12 hook
backend/src/modules/people/service.ts     createFaculty hook
backend/src/seed.ts                       templates + two demo accounts
backend/package.json                      deps + openapi:mobile script
.env.example, CLAUDE.md
```

---

### Task 1: Models

**Files:**
- Create: `backend/src/models/juvi/JuviAccount.ts`, `MobileSession.ts`, `ChannelTemplate.ts`, `Channel.ts`, `ChannelMembership.ts`, `JuviProvisioningRun.ts`, `JuviProvisionedCredential.ts`
- Modify: `backend/src/models/User.ts`, `backend/src/models/College.ts`, `backend/src/models/index.ts:399-409`
- Test: `backend/src/models/juvi/__tests__/juvi-app-models.schema.test.ts`

**Interfaces:**
- Produces: the exported models and types below. Every later task imports from these files. Key exported types: `AccountKind`, `AccountStatus`, `TransitionSource`, `IJuviAccount`, `IMobileSession`, `RevokeReason`, `ChannelScopeType`, `TemplateCode`, `MembershipRole`, `IChannel`, `IChannelMembership`, `IChannelTemplate`, `IJuviProvisioningRun`, `IJuviProvisionedCredential`, `IJuviConfig`.

- [ ] **Step 1: Write the failing schema test**

```ts
// backend/src/models/juvi/__tests__/juvi-app-models.schema.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/models/juvi/__tests__/juvi-app-models.schema.test.ts`
Expected: FAIL with "Cannot find module '../JuviAccount'".

- [ ] **Step 3: Create the seven models**

```ts
// backend/src/models/juvi/JuviAccount.ts
import { Schema, model, Document, Types } from 'mongoose';

export type AccountKind = 'student' | 'faculty' | 'staff';
export type AccountStatus = 'onboarding' | 'active' | 'exiting' | 'deactivated' | 'alumni';
export type TransitionSource = 'bulk' | 'workflow' | 'admin' | 'system';

export const ACCOUNT_KINDS: readonly AccountKind[] = ['student', 'faculty', 'staff'];
/** 'alumni' is reserved for Release 4 and is never set in R1. */
export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['onboarding', 'active', 'exiting', 'deactivated', 'alumni'];
export const TRANSITION_SOURCES: readonly TransitionSource[] = ['bulk', 'workflow', 'admin', 'system'];
/** Statuses that may hold channel memberships and sign in. */
export const ELIGIBLE_STATUSES: readonly AccountStatus[] = ['onboarding', 'active'];

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface IAccountTransition {
  from: AccountStatus | null;
  to: AccountStatus;
  source: TransitionSource;
  by: string;
  at: Date;
}

export interface IAccountSettings {
  quietHours: { start: string; end: string };
  tiers: { important: boolean; routine: boolean };
  language: 'en';
}

export interface IJuviAccount extends Document {
  collegeId: Types.ObjectId;
  personId: Types.ObjectId;
  userId: Types.ObjectId;
  kind: AccountKind;
  studentId?: Types.ObjectId;
  facultyId?: Types.ObjectId;
  staffId?: Types.ObjectId;
  status: AccountStatus;
  onboardingStep: number;
  onboardingCompletedAt?: Date;
  settings: IAccountSettings;
  lastSeenAt?: Date;
  lastReconciledAt?: Date;
  transitions: IAccountTransition[];
  provisionedAt: Date;
  provisionedBy: string;
}

const transitionSchema = new Schema<IAccountTransition>(
  {
    from: { type: String, enum: ACCOUNT_STATUSES, default: null },
    to: { type: String, enum: ACCOUNT_STATUSES, required: true },
    source: { type: String, enum: TRANSITION_SOURCES, required: true },
    by: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const schema = new Schema<IJuviAccount>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ACCOUNT_KINDS, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty' },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff' },
    status: { type: String, enum: ACCOUNT_STATUSES, required: true, default: 'onboarding' },
    onboardingStep: { type: Number, default: 0, min: 0 },
    onboardingCompletedAt: Date,
    settings: {
      quietHours: {
        start: { type: String, match: HHMM, default: '22:00' },
        end: { type: String, match: HHMM, default: '07:00' },
      },
      tiers: {
        important: { type: Boolean, default: true },
        routine: { type: Boolean, default: true },
      },
      language: { type: String, enum: ['en'], default: 'en' },
    },
    lastSeenAt: Date,
    lastReconciledAt: Date,
    transitions: { type: [transitionSchema], default: [] },
    provisionedAt: { type: Date, default: Date.now },
    provisionedBy: { type: String, required: true },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, personId: 1 }, { unique: true });
schema.index({ collegeId: 1, userId: 1 });
schema.index({ collegeId: 1, status: 1, kind: 1 });
schema.index({ collegeId: 1, studentId: 1 }, { sparse: true });
schema.index({ collegeId: 1, facultyId: 1 }, { sparse: true });

export const JuviAccount = model<IJuviAccount>('JuviAccount', schema);
```

```ts
// backend/src/models/juvi/MobileSession.ts
import { Schema, model, Document, Types } from 'mongoose';

export type MobilePlatform = 'android' | 'ios';
export type RevokeReason =
  | 'sign_out' | 'signed_out_elsewhere' | 'password_changed'
  | 'admin' | 'deactivated' | 'token_reuse' | 'expired';

export const REVOKE_REASONS: readonly RevokeReason[] = [
  'sign_out', 'signed_out_elsewhere', 'password_changed', 'admin', 'deactivated', 'token_reuse', 'expired',
];

export interface IMobileSession extends Document {
  collegeId: Types.ObjectId;
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  deviceId: string;
  deviceName: string;
  platform: MobilePlatform;
  appVersion: string;
  osVersion: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
  lastActiveAt: Date;
  revokedAt?: Date;
  revokedReason?: RevokeReason;
  pushToken?: string;
  createdAt: Date;
}

const schema = new Schema<IMobileSession>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    appVersion: { type: String, required: true },
    osVersion: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    refreshExpiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    revokedAt: Date,
    revokedReason: { type: String, enum: REVOKE_REASONS },
    pushToken: String,
  },
  { timestamps: true },
);

schema.index({ refreshTokenHash: 1 }, { unique: true });
schema.index({ collegeId: 1, accountId: 1 });
schema.index({ accountId: 1, deviceId: 1 });

export const MobileSession = model<IMobileSession>('MobileSession', schema);
```

```ts
// backend/src/models/juvi/ChannelTemplate.ts
import { Schema, model, Document, Types } from 'mongoose';

export type TemplateCode = 'college' | 'department' | 'batch' | 'course' | 'hostel';
export type ChannelScopeType = 'college' | 'department' | 'batch' | 'course_offering' | 'hostel_block';
export type ReplyRule = 'allowed' | 'announcement_only';
export type ChannelPriority = 'routine' | 'important';
export type ArchiveRule = 'on_semester_end' | 'never';

export const TEMPLATE_CODES: readonly TemplateCode[] = ['college', 'department', 'batch', 'course', 'hostel'];
export const CHANNEL_SCOPE_TYPES: readonly ChannelScopeType[] = ['college', 'department', 'batch', 'course_offering', 'hostel_block'];

export interface IChannelTemplate extends Document {
  collegeId: Types.ObjectId;
  code: TemplateCode;
  name: string;
  namePattern: string;
  aboutPattern: string;
  scopeType: ChannelScopeType;
  membershipStrategy: TemplateCode;
  postingRule: 'publishers_only';
  replyRule: ReplyRule;
  defaultPriority: ChannelPriority;
  archiveRule: ArchiveRule;
  isEnabled: boolean;
}

const schema = new Schema<IChannelTemplate>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, enum: TEMPLATE_CODES, required: true },
    name: { type: String, required: true },
    namePattern: { type: String, required: true },
    aboutPattern: { type: String, required: true },
    scopeType: { type: String, enum: CHANNEL_SCOPE_TYPES, required: true },
    membershipStrategy: { type: String, enum: TEMPLATE_CODES, required: true },
    postingRule: { type: String, enum: ['publishers_only'], required: true, default: 'publishers_only' },
    replyRule: { type: String, enum: ['allowed', 'announcement_only'], required: true },
    defaultPriority: { type: String, enum: ['routine', 'important'], required: true },
    archiveRule: { type: String, enum: ['on_semester_end', 'never'], required: true },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, code: 1 }, { unique: true });

export const ChannelTemplate = model<IChannelTemplate>('ChannelTemplate', schema);
```

```ts
// backend/src/models/juvi/Channel.ts
import { Schema, model, Document, Types } from 'mongoose';
import { ChannelScopeType, CHANNEL_SCOPE_TYPES, TemplateCode, TEMPLATE_CODES, ReplyRule, ChannelPriority } from './ChannelTemplate';

export type ChannelType = 'official' | 'custom' | 'dm';
export type ChannelStatus = 'active' | 'archived';

export interface IChannel extends Document {
  collegeId: Types.ObjectId;
  type: ChannelType;
  templateCode: TemplateCode;
  scopeType: ChannelScopeType;
  scopeId: Types.ObjectId | null;
  semesterId?: Types.ObjectId;
  name: string;
  about: string;
  status: ChannelStatus;
  archivedAt?: Date;
  postingRule: 'publishers_only';
  replyRule: ReplyRule;
  defaultPriority: ChannelPriority;
  memberCount: number;
  createdVia: 'reconcile' | 'admin';
}

const schema = new Schema<IChannel>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    // SPC-01: the full enum exists on the model; only 'official' is creatable in R1.
    type: { type: String, enum: ['official', 'custom', 'dm'], required: true, default: 'official' },
    templateCode: { type: String, enum: TEMPLATE_CODES, required: true },
    scopeType: { type: String, enum: CHANNEL_SCOPE_TYPES, required: true },
    scopeId: { type: Schema.Types.ObjectId, default: null },
    semesterId: { type: Schema.Types.ObjectId, ref: 'Semester' },
    name: { type: String, required: true },
    about: { type: String, required: true },
    status: { type: String, enum: ['active', 'archived'], required: true, default: 'active' },
    archivedAt: Date,
    postingRule: { type: String, enum: ['publishers_only'], required: true },
    replyRule: { type: String, enum: ['allowed', 'announcement_only'], required: true },
    defaultPriority: { type: String, enum: ['routine', 'important'], required: true },
    memberCount: { type: Number, default: 0 },
    createdVia: { type: String, enum: ['reconcile', 'admin'], default: 'reconcile' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, scopeType: 1, scopeId: 1 }, { unique: true });
schema.index({ collegeId: 1, status: 1 });

export const Channel = model<IChannel>('Channel', schema);
```

```ts
// backend/src/models/juvi/ChannelMembership.ts
import { Schema, model, Document, Types } from 'mongoose';

export type MembershipRole = 'member' | 'publisher';

export interface IChannelMembership extends Document {
  collegeId: Types.ObjectId;
  channelId: Types.ObjectId;
  accountId: Types.ObjectId;
  role: MembershipRole;
  mutedAt?: Date | null;
  joinedVia: 'rule' | 'admin';
  joinedAt: Date;
  lastReadAt?: Date;
}

const schema = new Schema<IChannelMembership>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    role: { type: String, enum: ['member', 'publisher'], required: true, default: 'member' },
    mutedAt: { type: Date, default: null },
    joinedVia: { type: String, enum: ['rule', 'admin'], required: true, default: 'rule' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: Date,
  },
  { timestamps: true },
);

schema.index({ channelId: 1, accountId: 1 }, { unique: true });
schema.index({ collegeId: 1, accountId: 1 });

export const ChannelMembership = model<IChannelMembership>('ChannelMembership', schema);
```

```ts
// backend/src/models/juvi/JuviProvisioningRun.ts
import { Schema, model, Document, Types } from 'mongoose';
import { AccountKind, ACCOUNT_KINDS } from './JuviAccount';

export type ProvisioningRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export interface IProvisioningFilter {
  kinds: AccountKind[];
  programmeIds?: Types.ObjectId[];
  batchIds?: Types.ObjectId[];
  departmentIds?: Types.ObjectId[];
}

export interface IJuviProvisioningRun extends Document {
  collegeId: Types.ObjectId;
  filter: IProvisioningFilter;
  options: { resetExistingPasswords: boolean };
  status: ProvisioningRunStatus;
  counts: { scanned: number; created: number; existingLinked: number; skipped: number; failed: number };
  errors: { personId: Types.ObjectId; reason: string }[];
  performedBy: string;
  startedAt?: Date;
  finishedAt?: Date;
  credentialsExpireAt?: Date;
}

const schema = new Schema<IJuviProvisioningRun>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    filter: {
      kinds: { type: [{ type: String, enum: ACCOUNT_KINDS }], required: true },
      programmeIds: [{ type: Schema.Types.ObjectId, ref: 'Programme' }],
      batchIds: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
      departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    },
    options: { resetExistingPasswords: { type: Boolean, default: true } },
    status: { type: String, enum: ['queued', 'running', 'completed', 'partial', 'failed'], default: 'queued' },
    counts: {
      scanned: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      existingLinked: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    errors: { type: [{ personId: Schema.Types.ObjectId, reason: String, _id: false }], default: [] },
    performedBy: { type: String, required: true },
    startedAt: Date,
    finishedAt: Date,
    credentialsExpireAt: Date,
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, createdAt: -1 });

export const JuviProvisioningRun = model<IJuviProvisioningRun>('JuviProvisioningRun', schema);
```

```ts
// backend/src/models/juvi/JuviProvisionedCredential.ts
import { Schema, model, Document, Types } from 'mongoose';

export type CredentialSource = 'bulk' | 'workflow' | 'admin';

export interface IJuviProvisionedCredential extends Document {
  collegeId: Types.ObjectId;
  runId?: Types.ObjectId | null;
  accountId: Types.ObjectId;
  source: CredentialSource;
  identifier: string;
  displayName: string;
  sectionId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  expiresAt: Date;
}

const schema = new Schema<IJuviProvisionedCredential>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    runId: { type: Schema.Types.ObjectId, ref: 'JuviProvisioningRun', default: null },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    source: { type: String, enum: ['bulk', 'workflow', 'admin'], required: true },
    identifier: { type: String, required: true },
    displayName: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    ciphertext: { type: Buffer, required: true },
    iv: { type: Buffer, required: true },
    authTag: { type: Buffer, required: true },
    // TTL index: Mongo deletes the row when expiresAt passes.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, runId: 1, sectionId: 1 });
schema.index({ collegeId: 1, accountId: 1 });

export const JuviProvisionedCredential = model<IJuviProvisionedCredential>('JuviProvisionedCredential', schema);
```

Modify `backend/src/models/User.ts` — add to the interface and schema:

```ts
// interface IUser: add
  mustChangePassword: boolean;
  passwordChangedAt?: Date;
// schema: add after isActive
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
```

Modify `backend/src/models/College.ts` — add the typed sub-document:

```ts
// add to ICollege
  juvi: IJuviConfig;

// add above the schema
export interface IJuviConfig {
  enabled: boolean;
  paused: boolean;
  pausedMessage?: string;
  accentColor?: string;
  supportContact?: { name: string; phone?: string; email?: string };
  quietHoursDefault: { start: string; end: string };
  minAppVersion?: { android?: string; ios?: string };
  timezone: string;
  featureFlags: { languageRoadmap: boolean };
}

const juviConfigSchema = new Schema<IJuviConfig>(
  {
    enabled: { type: Boolean, default: false },
    paused: { type: Boolean, default: false },
    pausedMessage: String,
    accentColor: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    supportContact: { type: new Schema({ name: String, phone: String, email: String }, { _id: false }), default: undefined },
    quietHoursDefault: {
      start: { type: String, default: '22:00' },
      end: { type: String, default: '07:00' },
    },
    minAppVersion: { type: new Schema({ android: String, ios: String }, { _id: false }), default: undefined },
    timezone: { type: String, default: 'Asia/Kolkata' },
    featureFlags: { languageRoadmap: { type: Boolean, default: false } },
  },
  { _id: false },
);

// in collegeSchema, after aiSpendLimits:
    juvi: { type: juviConfigSchema, default: () => ({}) },
```

Modify `backend/src/models/index.ts` — after line 409 (`StudyRecommendation`) add:

```ts
export { JuviAccount } from './juvi/JuviAccount';
export { MobileSession } from './juvi/MobileSession';
export { ChannelTemplate } from './juvi/ChannelTemplate';
export { Channel } from './juvi/Channel';
export { ChannelMembership } from './juvi/ChannelMembership';
export { JuviProvisioningRun } from './juvi/JuviProvisioningRun';
export { JuviProvisionedCredential } from './juvi/JuviProvisionedCredential';
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run src/models/juvi/__tests__/juvi-app-models.schema.test.ts && npm run typecheck`
Expected: PASS (8 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/juvi backend/src/models/User.ts backend/src/models/College.ts backend/src/models/index.ts
git commit -m "feat(juvi-app): add account, session, channel, template, membership and provisioning models

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Error envelope and module skeleton

**Files:**
- Create: `backend/src/modules/juvi-app/errors.ts`, `backend/src/modules/juvi-app/routes.ts`, `backend/src/modules/juvi-app/index.ts`
- Modify: `backend/src/app.ts:69-71`
- Test: `backend/src/modules/juvi-app/__tests__/errors.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type MobileErrorCode = 'VALIDATION_FAILED' | 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'SESSION_INVALIDATED' | 'ACCOUNT_DEACTIVATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'GONE' | 'UPDATE_REQUIRED' | 'COOLDOWN' | 'INSTITUTION_PAUSED' | 'INTERNAL';
  class MobileApiError extends AppError { constructor(statusCode: number, code: MobileErrorCode, message: string, detail?: Record<string, unknown>) }
  function mobileErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void
  function notFound(what: string): MobileApiError   // 404 helper
  ```
  `routes.ts` exports `default router` with `router.use('/v1', v1)` where `v1` is a `Router` that later tasks add sub-routers to via the exported `v1Router`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/__tests__/errors.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/__tests__/errors.test.ts`
Expected: FAIL with "Cannot find module '../errors'".

- [ ] **Step 3: Implement errors.ts, routes.ts, index.ts and mount**

```ts
// backend/src/modules/juvi-app/errors.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../middleware/errorHandler';

export type MobileErrorCode =
  | 'VALIDATION_FAILED' | 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'SESSION_INVALIDATED'
  | 'ACCOUNT_DEACTIVATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'GONE' | 'UPDATE_REQUIRED'
  | 'COOLDOWN' | 'INSTITUTION_PAUSED' | 'INTERNAL';

/**
 * Mobile-facing error. `detail` keys are spread into the envelope next to
 * `code` and `message` (e.g. retryAfterSeconds, reason, minVersion).
 */
export class MobileApiError extends AppError {
  constructor(
    statusCode: number,
    public code: MobileErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(statusCode, message, detail);
    this.name = 'MobileApiError';
  }
}

export function notFound(what: string): MobileApiError {
  return new MobileApiError(404, 'NOT_FOUND', `${what} not found`);
}

const STATUS_TO_CODE: Record<number, MobileErrorCode> = {
  400: 'VALIDATION_FAILED', 401: 'INVALID_CREDENTIALS', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
  410: 'GONE', 426: 'UPDATE_REQUIRED', 429: 'COOLDOWN', 503: 'INSTITUTION_PAUSED',
};

export function mobileErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof MobileApiError) {
    const detail = (err.detail && typeof err.detail === 'object') ? (err.detail as Record<string, unknown>) : {};
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message, ...detail } });
    return;
  }
  if (err instanceof ZodError) {
    // Paths only — never echo submitted values.
    const fields = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Some fields are invalid.', fields } });
    return;
  }
  if (err instanceof AppError) {
    const code = STATUS_TO_CODE[err.statusCode] ?? 'INTERNAL';
    res.status(err.statusCode).json({ error: { code, message: err.message } });
    return;
  }
  console.error('[juvi-app] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}
```

```ts
// backend/src/modules/juvi-app/routes.ts
import { Router } from 'express';
import { mobileErrorHandler, MobileApiError } from './errors';

/** Sub-routers register themselves onto v1Router in later tasks. */
export const v1Router = Router();

const router = Router();
router.use('/v1', v1Router);
// Anything under /api/juvi-app that no sub-router handled.
router.use((_req, _res, next) => next(new MobileApiError(404, 'NOT_FOUND', 'Route not found')));
router.use(mobileErrorHandler);

export default router;
```

```ts
// backend/src/modules/juvi-app/index.ts
export { default as router, v1Router } from './routes';
```

Modify `backend/src/app.ts`: add the import at the top with the others and mount **before** `apiRouter`:

```ts
import juviAppRouter from './modules/juvi-app/routes';
// ...
app.use('/api/auth', authRouter);
app.use('/api/juvi-app', juviAppRouter);   // mobile API: own auth + own error envelope
app.use('/api', apiRouter);
app.use(errorHandler);
```

Note: `validate()` middleware responds with the ERP shape on Zod errors. Mobile routes therefore do **not** use `validate()`; each controller calls `schema.parse(req.body)` inside its try block so ZodErrors reach `mobileErrorHandler` (Task 10 shows the pattern).

- [ ] **Step 4: Run tests and typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app/__tests__/errors.test.ts && npm run typecheck`
Expected: PASS (5 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app backend/src/app.ts
git commit -m "feat(juvi-app): mobile error envelope and module skeleton mounted at /api/juvi-app

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Temporary password generator

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/wordlist.ts` (generated), `backend/src/modules/juvi-app/accounts/temp-password.ts`
- Test: `backend/src/modules/juvi-app/accounts/__tests__/temp-password.test.ts`

**Interfaces:**
- Produces: `export function generateTemporaryPassword(): string` and `export const WORDLIST: readonly string[]` (2,048 entries).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/accounts/__tests__/temp-password.test.ts
import { describe, it, expect } from 'vitest';
import { generateTemporaryPassword } from '../temp-password';
import { WORDLIST } from '../wordlist';

describe('generateTemporaryPassword', () => {
  it('uses a 2048-word list of lowercase 3–8 letter words with no duplicates', () => {
    expect(WORDLIST).toHaveLength(2048);
    expect(new Set(WORDLIST).size).toBe(2048);
    for (const w of WORDLIST) expect(w).toMatch(/^[a-z]{3,8}$/);
  });

  it('produces word-word-NNN, at least 8 chars, from the list', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTemporaryPassword();
      const m = pw.match(/^([a-z]+)-([a-z]+)-(\d{3})$/);
      expect(m, pw).not.toBeNull();
      expect(WORDLIST).toContain(m![1]);
      expect(WORDLIST).toContain(m![2]);
      expect(pw.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('does not repeat across 10,000 draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateTemporaryPassword());
    expect(seen.size).toBeGreaterThan(9_990);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/temp-password.test.ts`
Expected: FAIL with "Cannot find module '../temp-password'".

- [ ] **Step 3: Generate the word list from the BIP-39 English list and implement**

The BIP-39 English list is 2,048 public-domain lowercase words, 3–8 letters, unique. Generate the module rather than typing it:

```bash
cd backend && curl -fsSL https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt -o /tmp/bip39.txt \
&& node -e '
const fs = require("fs");
const words = fs.readFileSync("/tmp/bip39.txt", "utf8").trim().split(/\r?\n/);
if (words.length !== 2048) throw new Error("expected 2048 words, got " + words.length);
const body = words.map(w => `  ${JSON.stringify(w)},`).join("\n");
fs.writeFileSync("src/modules/juvi-app/accounts/wordlist.ts",
`// Generated from the BIP-39 English word list (public domain). Do not edit by hand.
// 2,048 lowercase words, 3–8 letters, no duplicates. Used only for readable temporary passwords.
export const WORDLIST: readonly string[] = [
${body}
] as const;
`);
console.log("wrote", words.length, "words");
'
```

```ts
// backend/src/modules/juvi-app/accounts/temp-password.ts
import { randomInt } from 'node:crypto';
import { WORDLIST } from './wordlist';

/**
 * Temporary password for first sign-in: `word-word-NNN`.
 * Two words from a 2,048-word list plus a three-digit number gives
 * 2048 * 2048 * 1000 ≈ 4.3e9 combinations; combined with the per-identifier
 * cooldown this is far beyond online guessing, and it survives being read
 * aloud or written on a slip of paper.
 */
export function generateTemporaryPassword(): string {
  const a = WORDLIST[randomInt(WORDLIST.length)]!;
  const b = WORDLIST[randomInt(WORDLIST.length)]!;
  const n = String(randomInt(1000)).padStart(3, '0');
  return `${a}-${b}-${n}`;
}
```

- [ ] **Step 4: Run the test**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/temp-password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/accounts
git commit -m "feat(juvi-app): readable temporary password generator over a 2048-word list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Encrypted credential store

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/credential-store.ts`
- Test: `backend/src/modules/juvi-app/accounts/__tests__/credential-store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CREDENTIAL_TTL_DAYS = 7;
  export function getCredentialKey(): Buffer;            // 32 bytes from JUVI_CREDENTIAL_KEY or dev fallback
  export function encryptSecret(plain: string): { ciphertext: Buffer; iv: Buffer; authTag: Buffer };
  export function decryptSecret(row: { ciphertext: Buffer; iv: Buffer; authTag: Buffer }): string;
  export interface StoreCredentialInput { collegeId: string; accountId: string; runId?: string | null; source: CredentialSource; identifier: string; displayName: string; sectionId?: string; batchId?: string; departmentId?: string; plaintext: string }
  export async function storeCredential(input: StoreCredentialInput): Promise<string>;   // returns credential id
  export async function revealCredential(collegeId: string, credentialId: string): Promise<string | null>;
  export async function revealLatestForAccount(collegeId: string, accountId: string): Promise<{ credentialId: string; password: string; expiresAt: Date } | null>;
  ```

- [ ] **Step 1: Write the failing unit test (crypto only, no DB)**

```ts
// backend/src/modules/juvi-app/accounts/__tests__/credential-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, getCredentialKey } from '../credential-store';

describe('credential-store crypto', () => {
  const saved = process.env.JUVI_CREDENTIAL_KEY;
  beforeEach(() => { delete process.env.JUVI_CREDENTIAL_KEY; });
  afterEach(() => { if (saved) process.env.JUVI_CREDENTIAL_KEY = saved; else delete process.env.JUVI_CREDENTIAL_KEY; });

  it('round-trips a secret with a fresh iv each time', () => {
    const a = encryptSecret('river-lamp-482');
    const b = encryptSecret('river-lamp-482');
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(decryptSecret(a)).toBe('river-lamp-482');
    expect(decryptSecret(b)).toBe('river-lamp-482');
  });

  it('fails to decrypt when the auth tag is tampered', () => {
    const enc = encryptSecret('secret');
    const tampered = { ...enc, authTag: Buffer.from(enc.authTag.map((b) => b ^ 0xff)) };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('uses JUVI_CREDENTIAL_KEY when set and rejects a key that is not 32 bytes', () => {
    process.env.JUVI_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(getCredentialKey()).toEqual(Buffer.alloc(32, 7));
    process.env.JUVI_CREDENTIAL_KEY = Buffer.alloc(16, 7).toString('base64');
    expect(() => getCredentialKey()).toThrow(/32 bytes/);
  });

  it('falls back to a deterministic dev key when unset outside production', () => {
    expect(getCredentialKey()).toHaveLength(32);
    expect(getCredentialKey().equals(getCredentialKey())).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/credential-store.test.ts`
Expected: FAIL with "Cannot find module '../credential-store'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/accounts/credential-store.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { JuviProvisionedCredential, CredentialSource } from '../../../models/juvi/JuviProvisionedCredential';

export const CREDENTIAL_TTL_DAYS = 7;
const ALGO = 'aes-256-gcm';

/**
 * 32-byte key from JUVI_CREDENTIAL_KEY (base64). Outside production a
 * deterministic dev key is derived so local seeds work without config;
 * app.ts refuses to start in production without the real variable.
 */
export function getCredentialKey(): Buffer {
  const raw = process.env.JUVI_CREDENTIAL_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('JUVI_CREDENTIAL_KEY must decode to 32 bytes');
    return key;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('JUVI_CREDENTIAL_KEY is required in production');
  return createHash('sha256').update('juvi-dev-credential-key').digest();
}

export function encryptSecret(plain: string): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getCredentialKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptSecret(row: { ciphertext: Buffer; iv: Buffer; authTag: Buffer }): string {
  const decipher = createDecipheriv(ALGO, getCredentialKey(), row.iv);
  decipher.setAuthTag(row.authTag);
  return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');
}

export interface StoreCredentialInput {
  collegeId: string;
  accountId: string;
  runId?: string | null;
  source: CredentialSource;
  identifier: string;
  displayName: string;
  sectionId?: string;
  batchId?: string;
  departmentId?: string;
  plaintext: string;
}

export async function storeCredential(input: StoreCredentialInput): Promise<string> {
  const enc = encryptSecret(input.plaintext);
  const expiresAt = new Date(Date.now() + CREDENTIAL_TTL_DAYS * 86_400_000);
  const doc = await JuviProvisionedCredential.create({
    collegeId: input.collegeId,
    runId: input.runId ?? null,
    accountId: input.accountId,
    source: input.source,
    identifier: input.identifier,
    displayName: input.displayName,
    sectionId: input.sectionId,
    batchId: input.batchId,
    departmentId: input.departmentId,
    ...enc,
    expiresAt,
  });
  return String(doc._id);
}

export async function revealCredential(collegeId: string, credentialId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(credentialId)) return null;
  const row = await JuviProvisionedCredential.findOne({ _id: credentialId, collegeId, expiresAt: { $gt: new Date() } }).lean();
  if (!row) return null;
  return decryptSecret(row);
}

export async function revealLatestForAccount(
  collegeId: string,
  accountId: string,
): Promise<{ credentialId: string; password: string; expiresAt: Date } | null> {
  const row = await JuviProvisionedCredential.findOne({ collegeId, accountId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).lean();
  if (!row) return null;
  return { credentialId: String(row._id), password: decryptSecret(row), expiresAt: row.expiresAt };
}
```

- [ ] **Step 4: Run the test**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/credential-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/credential-store.ts backend/src/modules/juvi-app/accounts/__tests__/credential-store.test.ts
git commit -m "feat(juvi-app): AES-256-GCM credential store with seven-day TTL

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Institution config cache and version gate

**Files:**
- Create: `backend/src/modules/juvi-app/config/institution-config.ts`
- Test: `backend/src/modules/juvi-app/config/__tests__/institution-config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface JuviConfigView extends IJuviConfig { collegeId: string; name: string; code: string; logo?: string; collegeStatus: string }
  export async function getJuviConfig(collegeId: string): Promise<JuviConfigView | null>;   // Redis 60 s
  export async function invalidateJuviConfig(collegeId: string): Promise<void>;
  export async function isJuviEnabled(collegeId: string): Promise<boolean>;
  export async function lookupInstitutionByCode(code: string): Promise<JuviConfigView | null>; // enabled + active only
  export function isVersionBelow(current: string, minimum: string): boolean;
  ```
  Redis key: `juvi:cfg:{collegeId}`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/config/__tests__/institution-config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
const collegeMock = vi.hoisted(() => ({ findById: vi.fn(), findOne: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
vi.mock('../../../../models/College', () => ({ College: collegeMock }));

import { getJuviConfig, isJuviEnabled, isVersionBelow, lookupInstitutionByCode } from '../institution-config';

const lean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }), lean: () => Promise.resolve(v) });
const collegeDoc = { _id: 'c1', name: 'JIT', code: 'JIT', status: 'active', logo: 'k', juvi: { enabled: true, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false } } };

beforeEach(() => { vi.clearAllMocks(); redisMock.get.mockResolvedValue(null); redisMock.set.mockResolvedValue('OK'); });

describe('institution config', () => {
  it('isVersionBelow compares semver-ish strings', () => {
    expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionBelow('1.2.0', '1.10.0')).toBe(true);
    expect(isVersionBelow('2.0.0', '1.99.99')).toBe(false);
    expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionBelow('garbage', '1.0.0')).toBe(false);
  });

  it('reads from Mongo on cache miss and writes the cache for 60 s', async () => {
    collegeMock.findById.mockReturnValue(lean(collegeDoc));
    const cfg = await getJuviConfig('c1');
    expect(cfg?.enabled).toBe(true);
    expect(cfg?.name).toBe('JIT');
    expect(redisMock.set).toHaveBeenCalledWith('juvi:cfg:c1', expect.any(String), 'EX', 60);
  });

  it('serves from cache without touching Mongo', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ collegeId: 'c1', enabled: false }));
    const cfg = await getJuviConfig('c1');
    expect(cfg?.enabled).toBe(false);
    expect(collegeMock.findById).not.toHaveBeenCalled();
  });

  it('survives a Redis failure', async () => {
    redisMock.get.mockRejectedValue(new Error('ECONNREFUSED'));
    redisMock.set.mockRejectedValue(new Error('ECONNREFUSED'));
    collegeMock.findById.mockReturnValue(lean(collegeDoc));
    await expect(isJuviEnabled('c1')).resolves.toBe(true);
  });

  it('lookupInstitutionByCode returns null for disabled or inactive colleges', async () => {
    collegeMock.findOne.mockReturnValue(lean({ ...collegeDoc, juvi: { ...collegeDoc.juvi, enabled: false } }));
    expect(await lookupInstitutionByCode('jit')).toBeNull();
    collegeMock.findOne.mockReturnValue(lean({ ...collegeDoc, status: 'suspended' }));
    expect(await lookupInstitutionByCode('JIT')).toBeNull();
    collegeMock.findOne.mockReturnValue(lean(collegeDoc));
    expect((await lookupInstitutionByCode('jit'))?.code).toBe('JIT');
    expect(collegeMock.findOne).toHaveBeenLastCalledWith({ code: 'JIT' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/config/__tests__/institution-config.test.ts`
Expected: FAIL with "Cannot find module '../institution-config'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/config/institution-config.ts
import redis from '../../../config/redis';
import { College, IJuviConfig } from '../../../models/College';

const CACHE_TTL_SECONDS = 60;
const key = (collegeId: string) => `juvi:cfg:${collegeId}`;

export interface JuviConfigView extends IJuviConfig {
  collegeId: string;
  name: string;
  code: string;
  logo?: string;
  collegeStatus: string;
}

function toView(doc: any): JuviConfigView {
  const j: IJuviConfig = doc.juvi ?? {};
  return {
    collegeId: String(doc._id),
    name: doc.name,
    code: doc.code,
    logo: doc.logo,
    collegeStatus: doc.status,
    enabled: Boolean(j.enabled),
    paused: Boolean(j.paused),
    pausedMessage: j.pausedMessage,
    accentColor: j.accentColor,
    supportContact: j.supportContact,
    quietHoursDefault: j.quietHoursDefault ?? { start: '22:00', end: '07:00' },
    minAppVersion: j.minAppVersion,
    timezone: j.timezone ?? 'Asia/Kolkata',
    featureFlags: j.featureFlags ?? { languageRoadmap: false },
  };
}

export async function getJuviConfig(collegeId: string): Promise<JuviConfigView | null> {
  try {
    const cached = await redis.get(key(collegeId));
    if (cached) return JSON.parse(cached) as JuviConfigView;
  } catch { /* Redis down: fall through to Mongo */ }

  const doc = await College.findById(collegeId).select('name code logo status juvi').lean();
  if (!doc) return null;
  const view = toView(doc);
  try { await redis.set(key(collegeId), JSON.stringify(view), 'EX', CACHE_TTL_SECONDS); } catch { /* non-fatal */ }
  return view;
}

export async function invalidateJuviConfig(collegeId: string): Promise<void> {
  try { await redis.del(key(collegeId)); } catch { /* non-fatal */ }
}

export async function isJuviEnabled(collegeId: string): Promise<boolean> {
  const cfg = await getJuviConfig(collegeId);
  return Boolean(cfg?.enabled);
}

/** Public S01 lookup. Unknown, inactive and Juvi-disabled colleges all return null. */
export async function lookupInstitutionByCode(code: string): Promise<JuviConfigView | null> {
  const doc = await College.findOne({ code: code.trim().toUpperCase() }).select('name code logo status juvi').lean();
  if (!doc) return null;
  const view = toView(doc);
  if (view.collegeStatus !== 'active' || !view.enabled) return null;
  return view;
}

/** True when `current` is strictly below `minimum`. Non-numeric input never blocks. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map((p) => Number.parseInt(p, 10));
  const a = parse(current); const b = parse(minimum);
  if (a.some(Number.isNaN) || b.some(Number.isNaN) || a.length === 0 || b.length === 0) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0; const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}
```

- [ ] **Step 4: Run the test**

Run: `cd backend && npx vitest run src/modules/juvi-app/config/__tests__/institution-config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/config
git commit -m "feat(juvi-app): cached institution config, public code lookup and version gate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Cooldown counter and identifier resolver

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/cooldown.ts`, `backend/src/modules/juvi-app/accounts/identifier-resolver.ts`
- Test: `backend/src/modules/juvi-app/accounts/__tests__/cooldown.test.ts`, `backend/src/modules/juvi-app/accounts/__tests__/identifier-resolver.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // cooldown.ts
  export const COOLDOWN_MAX_FAILURES = 5; export const COOLDOWN_WINDOW_SECONDS = 600;
  export function cooldownKey(collegeId: string, identifier: string): string;
  export async function getCooldown(collegeId: string, identifier: string): Promise<{ blocked: boolean; retryAfterSeconds: number }>;
  export async function recordFailure(collegeId: string, identifier: string): Promise<void>;
  export async function clearFailures(collegeId: string, identifier: string): Promise<void>;
  // identifier-resolver.ts
  export async function resolveIdentifierToUser(collegeId: string, identifier: string): Promise<IUser | null>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/juvi-app/accounts/__tests__/cooldown.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const redisMock = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
import { getCooldown, recordFailure, clearFailures, cooldownKey } from '../cooldown';

beforeEach(() => vi.clearAllMocks());

describe('cooldown', () => {
  it('keys by college and a hash of the lower-cased identifier, never the raw value', () => {
    const k = cooldownKey('c1', '21CS1042');
    expect(k).toMatch(/^juvi:login-fail:c1:[0-9a-f]{64}$/);
    expect(k).toBe(cooldownKey('c1', '21cs1042'));
    expect(k).not.toContain('21CS1042');
  });

  it('is not blocked under five failures', async () => {
    redisMock.get.mockResolvedValue('4');
    expect(await getCooldown('c1', 'x')).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it('is blocked at five with the remaining ttl', async () => {
    redisMock.get.mockResolvedValue('5'); redisMock.ttl.mockResolvedValue(321);
    expect(await getCooldown('c1', 'x')).toEqual({ blocked: true, retryAfterSeconds: 321 });
  });

  it('recordFailure increments and sets the window only on the first failure', async () => {
    redisMock.incr.mockResolvedValue(1);
    await recordFailure('c1', 'x');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 600);
    redisMock.incr.mockResolvedValue(2); redisMock.expire.mockClear();
    await recordFailure('c1', 'x');
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('allows sign-in when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    expect(await getCooldown('c1', 'x')).toEqual({ blocked: false, retryAfterSeconds: 0 });
    redisMock.del.mockRejectedValue(new Error('down'));
    await expect(clearFailures('c1', 'x')).resolves.toBeUndefined();
  });
});
```

```ts
// backend/src/modules/juvi-app/accounts/__tests__/identifier-resolver.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({
  User: { findOne: vi.fn() }, Student: { findOne: vi.fn() }, Faculty: { findOne: vi.fn() }, Staff: { findOne: vi.fn() },
}));
vi.mock('../../../../models/User', () => ({ User: m.User }));
vi.mock('../../../../models/people/Student', () => ({ Student: m.Student }));
vi.mock('../../../../models/people/Faculty', () => ({ Faculty: m.Faculty }));
vi.mock('../../../../models/people/Staff', () => ({ Staff: m.Staff }));
import { resolveIdentifierToUser } from '../identifier-resolver';

const lean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });
beforeEach(() => { vi.clearAllMocks(); for (const k of Object.values(m)) k.findOne.mockReturnValue(lean(null)); });

describe('resolveIdentifierToUser', () => {
  it('treats anything with @ as an email and scopes by college', async () => {
    m.User.findOne.mockResolvedValue({ _id: 'u1' });
    const u = await resolveIdentifierToUser('c1', ' A@B.com ');
    expect(u).toEqual({ _id: 'u1' });
    expect(m.User.findOne).toHaveBeenCalledWith({ collegeId: 'c1', email: 'a@b.com' });
    expect(m.Student.findOne).not.toHaveBeenCalled();
  });

  it('resolves a roll number through Student → personId → User', async () => {
    m.Student.findOne.mockReturnValue(lean({ personId: 'p1' }));
    m.User.findOne.mockResolvedValue({ _id: 'u2' });
    expect(await resolveIdentifierToUser('c1', '21cs1042')).toEqual({ _id: 'u2' });
    expect(m.Student.findOne).toHaveBeenCalledWith({ collegeId: 'c1', rollNumber: { $in: ['21cs1042', '21CS1042'] } });
    expect(m.User.findOne).toHaveBeenCalledWith({ collegeId: 'c1', personId: 'p1' });
  });

  it('falls through Faculty then Staff employee codes', async () => {
    m.Faculty.findOne.mockReturnValue(lean(null));
    m.Staff.findOne.mockReturnValue(lean({ personId: 'p3' }));
    m.User.findOne.mockResolvedValue({ _id: 'u3' });
    expect(await resolveIdentifierToUser('c1', 'ST009')).toEqual({ _id: 'u3' });
    expect(m.Faculty.findOne).toHaveBeenCalledWith({ collegeId: 'c1', employeeCode: { $in: ['ST009', 'ST009'] } });
  });

  it('returns null when nothing matches', async () => {
    expect(await resolveIdentifierToUser('c1', 'nobody')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/cooldown.test.ts src/modules/juvi-app/accounts/__tests__/identifier-resolver.test.ts`
Expected: FAIL, both with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/accounts/cooldown.ts
import { createHash } from 'node:crypto';
import redis from '../../../config/redis';

export const COOLDOWN_MAX_FAILURES = 5;
export const COOLDOWN_WINDOW_SECONDS = 600;

/** Hash so the identifier itself never lands in Redis or logs. */
export function cooldownKey(collegeId: string, identifier: string): string {
  const h = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
  return `juvi:login-fail:${collegeId}:${h}`;
}

export async function getCooldown(collegeId: string, identifier: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  try {
    const k = cooldownKey(collegeId, identifier);
    const n = Number.parseInt((await redis.get(k)) ?? '0', 10);
    if (n < COOLDOWN_MAX_FAILURES) return { blocked: false, retryAfterSeconds: 0 };
    const ttl = await redis.ttl(k);
    return { blocked: true, retryAfterSeconds: Math.max(1, ttl) };
  } catch {
    // Redis unavailable: never lock everyone out; the per-IP limiter still applies.
    return { blocked: false, retryAfterSeconds: 0 };
  }
}

export async function recordFailure(collegeId: string, identifier: string): Promise<void> {
  try {
    const k = cooldownKey(collegeId, identifier);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, COOLDOWN_WINDOW_SECONDS);
  } catch { /* non-fatal */ }
}

export async function clearFailures(collegeId: string, identifier: string): Promise<void> {
  try { await redis.del(cooldownKey(collegeId, identifier)); } catch { /* non-fatal */ }
}
```

```ts
// backend/src/modules/juvi-app/accounts/identifier-resolver.ts
import { User, IUser } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';

/**
 * Sign-in identifier → User, always scoped by collegeId.
 * Order: email, student roll number, faculty employee code, staff employee code.
 */
export async function resolveIdentifierToUser(collegeId: string, identifier: string): Promise<IUser | null> {
  const id = identifier.trim();
  if (!id) return null;

  if (id.includes('@')) {
    return User.findOne({ collegeId, email: id.toLowerCase() });
  }

  const variants = { $in: [id, id.toUpperCase()] };
  const student = await Student.findOne({ collegeId, rollNumber: variants }).select('personId').lean();
  if (student?.personId) return User.findOne({ collegeId, personId: student.personId });

  const faculty = await Faculty.findOne({ collegeId, employeeCode: variants }).select('personId').lean();
  if (faculty?.personId) return User.findOne({ collegeId, personId: faculty.personId });

  const staff = await Staff.findOne({ collegeId, employeeCode: variants }).select('personId').lean();
  if (staff?.personId) return User.findOne({ collegeId, personId: staff.personId });

  return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/cooldown.test.ts src/modules/juvi-app/accounts/__tests__/identifier-resolver.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/accounts
git commit -m "feat(juvi-app): sign-in cooldown counter and identifier resolver

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Session service

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/session-service.ts`
- Test: `backend/src/modules/juvi-app/accounts/__tests__/session-service.test.ts` (token + cache logic, models mocked); DB behaviour is covered by the Task 10 integration test.

**Interfaces:**
- Produces:
  ```ts
  export const ACCESS_TOKEN_TTL_SECONDS = 900; export const REFRESH_TOKEN_TTL_DAYS = 90;
  export interface DeviceInfo { id: string; name: string; platform: 'android' | 'ios'; appVersion: string; osVersion: string }
  export interface MobileClaims { sub: string; sid: string; aid: string; cid: string; role: string; kind: AccountKind; typ: 'mobile' }
  export interface SessionTokens { accessToken: string; accessExpiresIn: number; refreshToken: string }
  export function signAccessToken(claims: Omit<MobileClaims, 'typ'>): string;
  export function verifyAccessToken(token: string): MobileClaims;   // throws MobileApiError TOKEN_EXPIRED | SESSION_INVALIDATED{reason:'invalid'}
  export function hashRefreshToken(token: string): string;
  export function newRefreshToken(): string;
  export async function createSession(input: { collegeId: string; accountId: string; userId: string; role: string; kind: AccountKind; device: DeviceInfo }): Promise<{ session: IMobileSession; tokens: SessionTokens }>;
  export async function rotateSession(refreshToken: string, deviceId: string, ctx: { role: string; kind: AccountKind }): Promise<{ session: IMobileSession; tokens: SessionTokens }>;
  export async function revokeSession(sessionId: string, reason: RevokeReason): Promise<void>;
  export async function revokeOtherSessions(accountId: string, keepSessionId: string | null, reason: RevokeReason): Promise<number>;
  export async function getSessionState(sessionId: string): Promise<{ state: 'active' } | { state: 'revoked'; reason: RevokeReason } | { state: 'missing' }>;
  export async function touchSession(sessionId: string): Promise<void>;   // lastActiveAt, throttled to once a minute via Redis NX key
  ```
  Redis: `juvi:sess:{sid}` = `active` (EX 60) or `revoked:{reason}` (EX 900).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/accounts/__tests__/session-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ findById: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), findOne: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
vi.mock('../../../../models/juvi/MobileSession', () => ({ MobileSession: sessionMock }));

import { signAccessToken, verifyAccessToken, hashRefreshToken, newRefreshToken, getSessionState, revokeSession } from '../session-service';
import { MobileApiError } from '../../errors';

const claims = { sub: 'u1', sid: 's1', aid: 'a1', cid: 'c1', role: 'student', kind: 'student' as const };
beforeEach(() => { vi.clearAllMocks(); process.env.JWT_SECRET = 'test-secret'; redisMock.set.mockResolvedValue('OK'); });

describe('access tokens', () => {
  it('signs a 15-minute HS256 token with typ mobile', () => {
    const token = signAccessToken(claims);
    const decoded = jwt.verify(token, 'test-secret') as any;
    expect(decoded.typ).toBe('mobile');
    expect(decoded.exp - decoded.iat).toBe(900);
    expect(verifyAccessToken(token)).toMatchObject({ ...claims, typ: 'mobile' });
  });

  it('rejects ERP tokens without typ mobile', () => {
    const erp = jwt.sign({ id: 'u1', role: 'admin' }, 'test-secret');
    expect(() => verifyAccessToken(erp)).toThrow(MobileApiError);
    try { verifyAccessToken(erp); } catch (e) { expect((e as MobileApiError).code).toBe('SESSION_INVALIDATED'); }
  });

  it('maps expiry to TOKEN_EXPIRED', () => {
    const expired = jwt.sign({ ...claims, typ: 'mobile' }, 'test-secret', { expiresIn: -10 });
    try { verifyAccessToken(expired); throw new Error('no throw'); } catch (e) { expect((e as MobileApiError).code).toBe('TOKEN_EXPIRED'); }
  });
});

describe('refresh tokens', () => {
  it('are 43-char base64url strings hashed with sha256', () => {
    const t = newRefreshToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashRefreshToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(t)).toBe(hashRefreshToken(t));
  });
});

describe('session state cache', () => {
  it('returns active from cache without Mongo', async () => {
    redisMock.get.mockResolvedValue('active');
    expect(await getSessionState('s1')).toEqual({ state: 'active' });
    expect(sessionMock.findById).not.toHaveBeenCalled();
  });

  it('returns revoked reason from cache', async () => {
    redisMock.get.mockResolvedValue('revoked:password_changed');
    expect(await getSessionState('s1')).toEqual({ state: 'revoked', reason: 'password_changed' });
  });

  it('on miss loads Mongo, caches active for 60 s', async () => {
    redisMock.get.mockResolvedValue(null);
    sessionMock.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 's1', revokedAt: null }) }) });
    expect(await getSessionState('s1')).toEqual({ state: 'active' });
    expect(redisMock.set).toHaveBeenCalledWith('juvi:sess:s1', 'active', 'EX', 60);
  });

  it('on miss with a revoked row caches revoked for 900 s', async () => {
    redisMock.get.mockResolvedValue(null);
    sessionMock.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 's1', revokedAt: new Date(), revokedReason: 'admin' }) }) });
    expect(await getSessionState('s1')).toEqual({ state: 'revoked', reason: 'admin' });
    expect(redisMock.set).toHaveBeenCalledWith('juvi:sess:s1', 'revoked:admin', 'EX', 900);
  });

  it('revokeSession writes Mongo then Redis synchronously', async () => {
    sessionMock.updateOne.mockResolvedValue({ modifiedCount: 1 });
    await revokeSession('s1', 'sign_out');
    expect(sessionMock.updateOne).toHaveBeenCalledWith({ _id: 's1', revokedAt: null }, { $set: { revokedAt: expect.any(Date), revokedReason: 'sign_out' } });
    expect(redisMock.set).toHaveBeenCalledWith('juvi:sess:s1', 'revoked:sign_out', 'EX', 900);
  });

  it('falls back to Mongo when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    sessionMock.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 's1', revokedAt: null }) }) });
    expect(await getSessionState('s1')).toEqual({ state: 'active' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/session-service.test.ts`
Expected: FAIL with "Cannot find module '../session-service'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/accounts/session-service.ts
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import redis from '../../../config/redis';
import { MobileSession, IMobileSession, RevokeReason, MobilePlatform } from '../../../models/juvi/MobileSession';
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { MobileApiError } from '../errors';

export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_DAYS = 90;
const ACTIVE_CACHE_SECONDS = 60;
const REVOKED_CACHE_SECONDS = ACCESS_TOKEN_TTL_SECONDS;

export interface DeviceInfo { id: string; name: string; platform: MobilePlatform; appVersion: string; osVersion: string }
export interface MobileClaims { sub: string; sid: string; aid: string; cid: string; role: string; kind: AccountKind; typ: 'mobile' }
export interface SessionTokens { accessToken: string; accessExpiresIn: number; refreshToken: string }

const secret = () => process.env.JWT_SECRET || 'dev-secret';
const sessKey = (sid: string) => `juvi:sess:${sid}`;

export function signAccessToken(claims: Omit<MobileClaims, 'typ'>): string {
  return jwt.sign({ ...claims, typ: 'mobile' }, secret(), { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

export function verifyAccessToken(token: string): MobileClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret(), { algorithms: ['HS256'] });
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw new MobileApiError(401, 'TOKEN_EXPIRED', 'Your session needs refreshing.');
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  }
  const c = decoded as Partial<MobileClaims>;
  if (c.typ !== 'mobile' || !c.sub || !c.sid || !c.aid || !c.cid) {
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  }
  return c as MobileClaims;
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}

async function cacheState(sid: string, value: string, ttl: number): Promise<void> {
  try { await redis.set(sessKey(sid), value, 'EX', ttl); } catch { /* non-fatal */ }
}

function tokensFor(session: IMobileSession, role: string, kind: AccountKind, refreshToken: string): SessionTokens {
  return {
    accessToken: signAccessToken({ sub: String(session.userId), sid: String(session._id), aid: String(session.accountId), cid: String(session.collegeId), role, kind }),
    accessExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
  };
}

export async function createSession(input: {
  collegeId: string; accountId: string; userId: string; role: string; kind: AccountKind; device: DeviceInfo;
}): Promise<{ session: IMobileSession; tokens: SessionTokens }> {
  // One live session per device: replace an earlier one for the same device id.
  const previous = await MobileSession.find({ accountId: input.accountId, deviceId: input.device.id, revokedAt: null }).select('_id').lean();
  for (const p of previous) await revokeSession(String(p._id), 'sign_out');

  const refreshToken = newRefreshToken();
  const session = await MobileSession.create({
    collegeId: input.collegeId,
    accountId: input.accountId,
    userId: input.userId,
    deviceId: input.device.id,
    deviceName: input.device.name,
    platform: input.device.platform,
    appVersion: input.device.appVersion,
    osVersion: input.device.osVersion,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshExpiresAt: refreshExpiry(),
    lastActiveAt: new Date(),
  });
  await cacheState(String(session._id), 'active', ACTIVE_CACHE_SECONDS);
  return { session, tokens: tokensFor(session, input.role, input.kind, refreshToken) };
}

/**
 * Rotate on refresh. The old hash is swapped atomically; a second presentation
 * of the same refresh token therefore misses, and if the session is still
 * active that is a replay: the whole session is revoked (spec §8).
 */
export async function rotateSession(
  refreshToken: string,
  deviceId: string,
  ctx: { role: string; kind: AccountKind },
): Promise<{ session: IMobileSession; tokens: SessionTokens }> {
  const oldHash = hashRefreshToken(refreshToken);
  const next = newRefreshToken();
  const session = await MobileSession.findOneAndUpdate(
    { refreshTokenHash: oldHash, deviceId, revokedAt: null, refreshExpiresAt: { $gt: new Date() } },
    { $set: { refreshTokenHash: hashRefreshToken(next), refreshExpiresAt: refreshExpiry(), lastActiveAt: new Date() } },
    { new: true },
  );
  if (!session) {
    // Was this token already rotated on a live session? Then someone replayed it.
    const live = await MobileSession.findOne({ deviceId, revokedAt: null }).select('_id').lean();
    if (live) await revokeSession(String(live._id), 'token_reuse');
    throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: live ? 'token_reuse' : 'expired' });
  }
  await cacheState(String(session._id), 'active', ACTIVE_CACHE_SECONDS);
  return { session, tokens: tokensFor(session, ctx.role, ctx.kind, next) };
}

export async function revokeSession(sessionId: string, reason: RevokeReason): Promise<void> {
  await MobileSession.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
  // Write-through so the very next request on that device sees it (spec §8).
  await cacheState(sessionId, `revoked:${reason}`, REVOKED_CACHE_SECONDS);
}

export async function revokeOtherSessions(accountId: string, keepSessionId: string | null, reason: RevokeReason): Promise<number> {
  const filter: Record<string, unknown> = { accountId, revokedAt: null };
  if (keepSessionId) filter._id = { $ne: keepSessionId };
  const others = await MobileSession.find(filter).select('_id').lean();
  for (const s of others) await revokeSession(String(s._id), reason);
  return others.length;
}

export async function getSessionState(sessionId: string): Promise<
  { state: 'active' } | { state: 'revoked'; reason: RevokeReason } | { state: 'missing' }
> {
  try {
    const cached = await redis.get(sessKey(sessionId));
    if (cached === 'active') return { state: 'active' };
    if (cached?.startsWith('revoked:')) return { state: 'revoked', reason: cached.slice('revoked:'.length) as RevokeReason };
  } catch { /* fall through to Mongo */ }

  const row = await MobileSession.findById(sessionId).select('revokedAt revokedReason').lean();
  if (!row) return { state: 'missing' };
  if (row.revokedAt) {
    const reason = (row.revokedReason ?? 'expired') as RevokeReason;
    await cacheState(sessionId, `revoked:${reason}`, REVOKED_CACHE_SECONDS);
    return { state: 'revoked', reason };
  }
  await cacheState(sessionId, 'active', ACTIVE_CACHE_SECONDS);
  return { state: 'active' };
}

/** lastActiveAt at most once a minute per session. */
export async function touchSession(sessionId: string): Promise<void> {
  try {
    const ok = await redis.set(`juvi:sess-touch:${sessionId}`, '1', 'EX', 60, 'NX');
    if (ok !== 'OK') return;
  } catch { /* if Redis is down, just write */ }
  await MobileSession.updateOne({ _id: sessionId }, { $set: { lastActiveAt: new Date() } });
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app/accounts/__tests__/session-service.test.ts && npm run typecheck`
Expected: PASS (10 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/accounts
git commit -m "feat(juvi-app): per-device sessions with rotating refresh tokens and write-through revocation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Mobile authentication middleware

**Files:**
- Create: `backend/src/modules/juvi-app/middleware/authenticate-mobile.ts`, `backend/src/modules/juvi-app/middleware/rate-limits.ts`
- Test: `backend/src/modules/juvi-app/middleware/__tests__/authenticate-mobile.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken`, `getSessionState`, `touchSession` (Task 7); `getJuviConfig`, `isVersionBelow` (Task 5); `JuviAccount` (Task 1); `MobileApiError` (Task 2).
- Produces:
  ```ts
  export interface MobileContext { userId: string; accountId: string; sessionId: string; collegeId: string; role: string; kind: AccountKind; studentId?: string; facultyId?: string; staffId?: string; account: IJuviAccount }
  export interface MobileRequest extends Request { mobile?: MobileContext }
  export async function authenticateMobile(req: MobileRequest, res: Response, next: NextFunction): Promise<void>;
  export function requireMobile(req: MobileRequest): MobileContext;   // throws if middleware did not run
  export const STORE_URLS: { android: string; ios: string };
  // rate-limits.ts
  export const signInLimiter: RequestHandler;            // 10 per minute per IP
  export const institutionLookupLimiter: RequestHandler; // 20 per minute per IP
  ```

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/middleware/__tests__/authenticate-mobile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sess = vi.hoisted(() => ({ verifyAccessToken: vi.fn(), getSessionState: vi.fn(), touchSession: vi.fn().mockResolvedValue(undefined) }));
const cfg = vi.hoisted(() => ({ getJuviConfig: vi.fn(), isVersionBelow: (c: string, m: string) => c < m }));
const account = vi.hoisted(() => ({ findById: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) }));
const redisMock = vi.hoisted(() => ({ set: vi.fn().mockResolvedValue('OK') }));
vi.mock('../../accounts/session-service', () => sess);
vi.mock('../../config/institution-config', () => cfg);
vi.mock('../../../../models/juvi/JuviAccount', () => ({ JuviAccount: account }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));

import { authenticateMobile } from '../authenticate-mobile';
import { MobileApiError } from '../../errors';

const claims = { sub: 'u1', sid: 's1', aid: 'a1', cid: 'c1', role: 'student', kind: 'student', typ: 'mobile' };
const activeAccount = { _id: 'a1', collegeId: 'c1', status: 'active', kind: 'student', studentId: 'st1' };
const enabledCfg = { enabled: true, paused: false, minAppVersion: { android: '1.0.0' }, supportContact: { name: 'Office' } };

function req(headers: Record<string, string> = {}) {
  return { headers: { authorization: 'Bearer t', 'x-juvi-app-version': '1.0.0', 'x-juvi-platform': 'android', ...headers } } as any;
}
async function run(r: any) {
  const next = vi.fn();
  await authenticateMobile(r, {} as any, next);
  return next.mock.calls[0]?.[0] as MobileApiError | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  sess.verifyAccessToken.mockReturnValue(claims);
  sess.getSessionState.mockResolvedValue({ state: 'active' });
  account.findById.mockReturnValue({ lean: () => Promise.resolve(activeAccount) });
  cfg.getJuviConfig.mockResolvedValue(enabledCfg);
});

describe('authenticateMobile', () => {
  it('sets req.mobile and calls next with no error on the happy path', async () => {
    const r = req();
    expect(await run(r)).toBeUndefined();
    expect(r.mobile).toMatchObject({ userId: 'u1', accountId: 'a1', sessionId: 's1', collegeId: 'c1', kind: 'student', studentId: 'st1' });
  });

  it('401 SESSION_INVALIDATED missing when there is no bearer', async () => {
    const e = await run(req({ authorization: '' }));
    expect(e?.code).toBe('SESSION_INVALIDATED');
    expect(e?.detail).toEqual({ reason: 'missing' });
  });

  it('propagates TOKEN_EXPIRED from the verifier', async () => {
    sess.verifyAccessToken.mockImplementation(() => { throw new MobileApiError(401, 'TOKEN_EXPIRED', 'x'); });
    expect((await run(req()))?.code).toBe('TOKEN_EXPIRED');
  });

  it('401 with the revoke reason when the session is revoked', async () => {
    sess.getSessionState.mockResolvedValue({ state: 'revoked', reason: 'signed_out_elsewhere' });
    const e = await run(req());
    expect(e?.code).toBe('SESSION_INVALIDATED');
    expect(e?.detail).toEqual({ reason: 'signed_out_elsewhere' });
  });

  it('403 ACCOUNT_DEACTIVATED with support contact', async () => {
    account.findById.mockReturnValue({ lean: () => Promise.resolve({ ...activeAccount, status: 'deactivated' }) });
    const e = await run(req());
    expect(e?.statusCode).toBe(403);
    expect(e?.code).toBe('ACCOUNT_DEACTIVATED');
    expect(e?.detail).toEqual({ supportContact: { name: 'Office' } });
  });

  it('401 when the token college does not match the account', async () => {
    account.findById.mockReturnValue({ lean: () => Promise.resolve({ ...activeAccount, collegeId: 'other' }) });
    expect((await run(req()))?.code).toBe('SESSION_INVALIDATED');
  });

  it('503 INSTITUTION_PAUSED with the configured message', async () => {
    cfg.getJuviConfig.mockResolvedValue({ ...enabledCfg, paused: true, pausedMessage: 'Back Monday' });
    const e = await run(req());
    expect(e?.statusCode).toBe(503);
    expect(e?.detail).toEqual({ message: 'Back Monday' });
  });

  it('426 UPDATE_REQUIRED when below the platform minimum', async () => {
    cfg.getJuviConfig.mockResolvedValue({ ...enabledCfg, minAppVersion: { android: '1.2.0' } });
    const e = await run(req({ 'x-juvi-app-version': '1.1.0' }));
    expect(e?.statusCode).toBe(426);
    expect(e?.detail).toMatchObject({ minVersion: '1.2.0', storeUrl: expect.stringContaining('play.google.com') });
  });

  it('does not gate when the client sends no version header', async () => {
    cfg.getJuviConfig.mockResolvedValue({ ...enabledCfg, minAppVersion: { android: '9.0.0' } });
    expect(await run(req({ 'x-juvi-app-version': '' }))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/middleware/__tests__/authenticate-mobile.test.ts`
Expected: FAIL with "Cannot find module '../authenticate-mobile'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/middleware/authenticate-mobile.ts
import { Request, Response, NextFunction } from 'express';
import redis from '../../../config/redis';
import { JuviAccount, IJuviAccount, AccountKind } from '../../../models/juvi/JuviAccount';
import { verifyAccessToken, getSessionState, touchSession } from '../accounts/session-service';
import { getJuviConfig, isVersionBelow } from '../config/institution-config';
import { MobileApiError } from '../errors';

export interface MobileContext {
  userId: string;
  accountId: string;
  sessionId: string;
  collegeId: string;
  role: string;
  kind: AccountKind;
  studentId?: string;
  facultyId?: string;
  staffId?: string;
  account: IJuviAccount;
}

export interface MobileRequest extends Request { mobile?: MobileContext }

export const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=in.juvion.juvi',
  // Set JUVI_IOS_STORE_URL once the iOS app is published (Plan 3 / sub-project 7).
  ios: process.env.JUVI_IOS_STORE_URL ?? 'https://apps.apple.com/',
};

const invalid = (reason: string) => new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason });

export async function authenticateMobile(req: MobileRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ') || header.length <= 7) throw invalid('missing');
    const claims = verifyAccessToken(header.slice(7));

    const state = await getSessionState(claims.sid);
    if (state.state !== 'active') throw invalid(state.state === 'revoked' ? state.reason : 'expired');

    const account = await JuviAccount.findById(claims.aid).lean();
    if (!account || String(account.collegeId) !== claims.cid) throw invalid('invalid');

    const cfg = await getJuviConfig(claims.cid);
    if (account.status === 'deactivated') {
      throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', 'This account is no longer active at your institution.', { supportContact: cfg?.supportContact ?? null });
    }
    if (!cfg || !cfg.enabled) {
      throw new MobileApiError(503, 'INSTITUTION_PAUSED', 'Juvi is not available for your institution right now.', { message: 'Juvi is not available for your institution right now.' });
    }
    if (cfg.paused) {
      throw new MobileApiError(503, 'INSTITUTION_PAUSED', cfg.pausedMessage ?? 'Juvi is paused.', { message: cfg.pausedMessage ?? 'Juvi is paused.' });
    }

    const platform = String(req.headers['x-juvi-platform'] ?? '') as 'android' | 'ios' | '';
    const version = String(req.headers['x-juvi-app-version'] ?? '');
    const min = platform ? cfg.minAppVersion?.[platform] : undefined;
    if (version && min && isVersionBelow(version, min)) {
      throw new MobileApiError(426, 'UPDATE_REQUIRED', 'Please update Juvi to continue.', { minVersion: min, storeUrl: STORE_URLS[platform || 'android'] });
    }

    req.mobile = {
      userId: claims.sub,
      accountId: String(account._id),
      sessionId: claims.sid,
      collegeId: claims.cid,
      role: claims.role,
      kind: account.kind,
      studentId: account.studentId ? String(account.studentId) : undefined,
      facultyId: account.facultyId ? String(account.facultyId) : undefined,
      staffId: account.staffId ? String(account.staffId) : undefined,
      account: account as unknown as IJuviAccount,
    };

    // Activity markers, at most once a minute, never blocking the request.
    void touchSession(claims.sid).catch(() => undefined);
    void touchAccount(String(account._id)).catch(() => undefined);
    next();
  } catch (e) {
    next(e);
  }
}

async function touchAccount(accountId: string): Promise<void> {
  try {
    const ok = await redis.set(`juvi:acct-touch:${accountId}`, '1', 'EX', 60, 'NX');
    if (ok !== 'OK') return;
  } catch { /* if Redis is down, just write */ }
  await JuviAccount.updateOne({ _id: accountId }, { $set: { lastSeenAt: new Date() } });
}

export function requireMobile(req: MobileRequest): MobileContext {
  if (!req.mobile) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'missing' });
  return req.mobile;
}
```

```ts
// backend/src/modules/juvi-app/middleware/rate-limits.ts
import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';

const disabled = () =>
  process.env.E2E_TESTING === '1' || process.env.E2E_TESTING === 'true' || process.env.NODE_ENV === 'test';

function limiter(max: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: disabled,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'COOLDOWN', message: 'Too many requests. Try again in a minute.', retryAfterSeconds: 60 } });
    },
  });
}

/** 10 sign-in attempts per minute per IP, on top of the per-identifier cooldown. */
export const signInLimiter = limiter(10);
/** 20 institution lookups per minute per IP. */
export const institutionLookupLimiter = limiter(20);
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app/middleware/__tests__/authenticate-mobile.test.ts && npm run typecheck`
Expected: PASS (9 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/middleware
git commit -m "feat(juvi-app): mobile auth middleware with session, deactivation, pause and version gates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Provisioning service and test factory

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/provisioning-service.ts`, `backend/src/__e2e__/factories/juvi.factory.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-provisioning.e2e.test.ts`

**Interfaces:**
- Consumes: `generateTemporaryPassword` (Task 3), `storeCredential`, `revealLatestForAccount` (Task 4), `revokeOtherSessions` (Task 7), models (Task 1), `createAuditLog`.
- Produces:
  ```ts
  export interface ProvisionPersonInput { collegeId: string; personId: string; kind: AccountKind; source: TransitionSource; performedBy: string; resetPassword?: boolean; runId?: string | null }
  export interface ProvisionPersonResult { account: IJuviAccount; created: boolean; userCreated: boolean; credentialId?: string }
  export function placeholderEmail(identifier: string, collegeCode: string): string;
  export async function provisionPerson(input: ProvisionPersonInput): Promise<ProvisionPersonResult>;
  export async function transitionAccount(account: IJuviAccount, to: AccountStatus, source: TransitionSource, by: string): Promise<IJuviAccount>;
  export async function deactivateAccount(collegeId: string, accountId: string, source: TransitionSource, performedBy: string): Promise<IJuviAccount>;
  // juvi.factory.ts
  export const TEST_DEVICE: DeviceInfo;
  export async function enableJuvi(collegeId: string, patch?: Partial<IJuviConfig>): Promise<void>;
  export async function provisionTestStudent(fx: BaseFixtures, opts?: { sectionId?: string; batchId?: string; branchId?: string; withUser?: boolean }): Promise<{ person; student; account; tempPassword: string }>;
  export async function provisionTestFaculty(fx: BaseFixtures, opts?: { departmentId?: string }): Promise<{ person; faculty; account; tempPassword: string }>;
  export function mobileClient(app: Express, accessToken?: string): { get; post; patch; put; delete }   // sets Bearer + X-Juvi-* headers
  ```

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-provisioning.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestStudent } from '../factories/student.factory';
import { createTestFaculty } from '../factories/academic.factory';
import { Person, Student, Department } from '../../models';
import { User } from '../../models/User';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { MobileSession } from '../../models/juvi/MobileSession';
import { AuditLog } from '../../shared/audit';
import { provisionPerson, deactivateAccount, placeholderEmail } from '../../modules/juvi-app/accounts/provisioning-service';
import { revealLatestForAccount } from '../../modules/juvi-app/accounts/credential-store';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('provisionPerson', () => {
  it('builds a placeholder email in the reserved .invalid TLD', () => {
    expect(placeholderEmail('21CS1042', 'JIT')).toBe('21cs1042@no-email.jit.juvion.invalid');
  });

  it('creates a User and account for a student with no login, stores a credential, audits', async () => {
    const person = await Person.create({ collegeId: fx.collegeId, name: 'No Login', phone: '9111111111' });
    const student = await Student.create({ collegeId: fx.collegeId, personId: person._id, admissionYear: 2024, rollNumber: '24JIT9001', status: 'active', batchId: fx.batch._id, branchId: fx.cseBranch._id });
    const r = await provisionPerson({ collegeId: fx.collegeId, personId: String(person._id), kind: 'student', source: 'bulk', performedBy: 'admin' });
    expect(r.created).toBe(true);
    expect(r.userCreated).toBe(true);
    expect(r.account.status).toBe('onboarding');
    expect(String(r.account.studentId)).toBe(String(student._id));
    const user = await User.findById(r.account.userId).lean();
    expect(user?.email).toBe('24jit9001@no-email.jit-test.juvion.invalid');
    expect(user?.role).toBe('student');
    expect(user?.personaType).toBe('L-STU');
    expect(user?.mustChangePassword).toBe(true);
    const cred = await revealLatestForAccount(fx.collegeId, String(r.account._id));
    expect(cred?.password).toMatch(/^[a-z]+-[a-z]+-\d{3}$/);
    expect(await bcrypt.compare(cred!.password, user!.password)).toBe(true);
    const audit = await AuditLog.findOne({ entityType: 'JuviAccount', entityId: String(r.account._id) }).lean();
    expect(audit?.action).toBe('create');
    expect(r.account.transitions).toEqual([expect.objectContaining({ from: null, to: 'onboarding', source: 'bulk', by: 'admin' })]);
  });

  it('links an existing User, resets its password by default, and is idempotent', async () => {
    const s = await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const first = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    expect(first.userCreated).toBe(false);
    expect(String(first.account.userId)).toBe(String(s.user._id));
    const user = await User.findById(s.user._id).lean();
    expect(await bcrypt.compare('test123', user!.password)).toBe(false);
    expect(user?.mustChangePassword).toBe(true);

    const second = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    expect(second.created).toBe(false);
    expect(String(second.account._id)).toBe(String(first.account._id));
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(1);
    expect(await JuviProvisionedCredential.countDocuments({ accountId: first.account._id })).toBe(1);
  });

  it('keeps the existing password when resetPassword is false', async () => {
    const s = await createTestStudent(fx.collegeId);
    await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin', resetPassword: false });
    const user = await User.findById(s.user._id).lean();
    expect(await bcrypt.compare('test123', user!.password)).toBe(true);
    expect(user?.mustChangePassword).toBe(false);
  });

  it('assigns hod role when the faculty heads a department', async () => {
    const f = await createTestFaculty(fx.collegeId, { departmentId: String(fx.cse._id) });
    await User.deleteOne({ _id: f.user._id });
    await Department.updateOne({ _id: fx.cse._id }, { $set: { hodId: f.faculty._id } });
    const r = await provisionPerson({ collegeId: fx.collegeId, personId: String(f.person._id), kind: 'faculty', source: 'workflow', performedBy: 'hr' });
    const user = await User.findById(r.account.userId).lean();
    expect(user?.role).toBe('hod');
    expect(user?.personaType).toBe('F-HOD');
    expect(String(r.account.facultyId)).toBe(String(f.faculty._id));
  });

  it('refuses a person that has no row of the requested kind', async () => {
    const person = await Person.create({ collegeId: fx.collegeId, name: 'Ghost', phone: '9222222222' });
    await expect(provisionPerson({ collegeId: fx.collegeId, personId: String(person._id), kind: 'faculty', source: 'admin', performedBy: 'x' }))
      .rejects.toThrow(/no faculty record/i);
  });
});

describe('deactivateAccount', () => {
  it('sets deactivated, disables the User, revokes sessions, drops memberships, audits', async () => {
    const s = await createTestStudent(fx.collegeId);
    const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    await MobileSession.create({ collegeId: fx.collegeId, accountId: account._id, userId: account.userId, deviceId: 'd', deviceName: 'n', platform: 'android', appVersion: '1', osVersion: '1', refreshTokenHash: 'h1', refreshExpiresAt: new Date(Date.now() + 1000) });
    await ChannelMembership.create({ collegeId: fx.collegeId, channelId: fx.batch._id, accountId: account._id });

    const out = await deactivateAccount(fx.collegeId, String(account._id), 'admin', 'admin');
    expect(out.status).toBe('deactivated');
    expect(out.transitions.at(-1)).toMatchObject({ from: 'onboarding', to: 'deactivated', source: 'admin' });
    expect((await User.findById(account.userId).lean())?.isActive).toBe(false);
    expect((await MobileSession.findOne({ accountId: account._id }).lean())?.revokedReason).toBe('deactivated');
    expect(await ChannelMembership.countDocuments({ accountId: account._id })).toBe(0);
    expect(await AuditLog.countDocuments({ entityType: 'JuviAccount', entityId: String(account._id), action: 'update' })).toBe(1);
  });

  it('is a 404 for another college', async () => {
    const s = await createTestStudent(fx.collegeId);
    const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'admin' });
    await expect(deactivateAccount('000000000000000000000099', String(account._id), 'admin', 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-provisioning.e2e.test.ts`
Expected: FAIL with "Cannot find module '../../modules/juvi-app/accounts/provisioning-service'".

- [ ] **Step 3: Implement the service and the factory**

```ts
// backend/src/modules/juvi-app/accounts/provisioning-service.ts
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User, IUser } from '../../../models/User';
import { College } from '../../../models/College';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Department } from '../../../models/academic-structure/Department';
import { Branch } from '../../../models/academic-structure/Branch';
import { Section } from '../../../models/academic-structure/Section';
import { JuviAccount, IJuviAccount, AccountKind, AccountStatus, TransitionSource } from '../../../models/juvi/JuviAccount';
import { ChannelMembership } from '../../../models/juvi/ChannelMembership';
import { createAuditLog } from '../../../shared/audit';
import { generateTemporaryPassword } from './temp-password';
import { storeCredential } from './credential-store';
import { revokeOtherSessions } from './session-service';
import { getJuviConfig } from '../config/institution-config';
import { MobileApiError, notFound } from '../errors';

export interface ProvisionPersonInput {
  collegeId: string;
  personId: string;
  kind: AccountKind;
  source: TransitionSource;
  performedBy: string;
  /** Default true. When false an existing User keeps its password and flag. */
  resetPassword?: boolean;
  runId?: string | null;
}

export interface ProvisionPersonResult {
  account: IJuviAccount;
  created: boolean;
  userCreated: boolean;
  credentialId?: string;
}

/** `.invalid` is a reserved TLD (RFC 2606): the address can never receive mail. */
export function placeholderEmail(identifier: string, collegeCode: string): string {
  const safe = identifier.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'user';
  return `${safe}@no-email.${collegeCode.toLowerCase()}.juvion.invalid`;
}

interface KindRow {
  entityId: Types.ObjectId;
  identifier: string;
  sectionId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  role: string;
  personaType: string;
}

async function loadKindRow(collegeId: string, personId: string, kind: AccountKind): Promise<KindRow> {
  if (kind === 'student') {
    const s = await Student.findOne({ collegeId, personId }).select('_id rollNumber batchId branchId').lean();
    if (!s) throw new MobileApiError(404, 'NOT_FOUND', 'Person has no student record');
    const section = await Section.findOne({ collegeId, studentIds: s._id }).select('_id').lean();
    const branch = s.branchId ? await Branch.findById(s.branchId).select('departmentId').lean() : null;
    return {
      entityId: s._id, identifier: s.rollNumber ?? String(s._id), sectionId: section?._id, batchId: s.batchId ?? undefined,
      departmentId: branch?.departmentId ?? undefined, role: 'student', personaType: 'L-STU',
    };
  }
  if (kind === 'faculty') {
    const f = await Faculty.findOne({ collegeId, personId }).select('_id employeeCode departmentId').lean();
    if (!f) throw new MobileApiError(404, 'NOT_FOUND', 'Person has no faculty record');
    const isHod = await Department.exists({ collegeId, hodId: f._id });
    return {
      entityId: f._id, identifier: f.employeeCode, departmentId: f.departmentId ?? undefined,
      role: isHod ? 'hod' : 'faculty', personaType: isHod ? 'F-HOD' : 'F-FAC',
    };
  }
  const st = await Staff.findOne({ collegeId, personId }).select('_id employeeCode departmentId personaCode').lean();
  if (!st) throw new MobileApiError(404, 'NOT_FOUND', 'Person has no staff record');
  return {
    entityId: st._id, identifier: st.employeeCode, departmentId: st.departmentId ?? undefined,
    role: 'staff', personaType: st.personaCode ?? 'ST-REG',
  };
}

export async function provisionPerson(input: ProvisionPersonInput): Promise<ProvisionPersonResult> {
  const resetPassword = input.resetPassword ?? true;
  const person = await Person.findOne({ _id: input.personId, collegeId: input.collegeId }).select('name email').lean();
  if (!person) throw notFound('Person');
  const college = await College.findById(input.collegeId).select('code juvi').lean();
  if (!college) throw notFound('College');
  const row = await loadKindRow(input.collegeId, input.personId, input.kind);

  // Existing account: nothing to do (idempotent).
  const existing = await JuviAccount.findOne({ collegeId: input.collegeId, personId: input.personId });
  if (existing) return { account: existing, created: false, userCreated: false };

  let user: IUser | null = await User.findOne({ collegeId: input.collegeId, personId: input.personId });
  let userCreated = false;
  let temporaryPassword: string | undefined;

  if (!user) {
    temporaryPassword = generateTemporaryPassword();
    user = await User.create({
      collegeId: input.collegeId,
      email: (person.email ?? '').trim().toLowerCase() || placeholderEmail(row.identifier, college.code),
      password: await bcrypt.hash(temporaryPassword, 10),
      name: person.name,
      role: row.role,
      personaType: row.personaType,
      personId: input.personId,
      isActive: true,
      mustChangePassword: true,
    });
    userCreated = true;
  } else if (resetPassword) {
    temporaryPassword = generateTemporaryPassword();
    user.password = await bcrypt.hash(temporaryPassword, 10);
    user.mustChangePassword = true;
    user.isActive = true;
    await user.save();
  }

  const quiet = college.juvi?.quietHoursDefault ?? { start: '22:00', end: '07:00' };
  const account = await JuviAccount.create({
    collegeId: input.collegeId,
    personId: input.personId,
    userId: user._id,
    kind: input.kind,
    studentId: input.kind === 'student' ? row.entityId : undefined,
    facultyId: input.kind === 'faculty' ? row.entityId : undefined,
    staffId: input.kind === 'staff' ? row.entityId : undefined,
    status: 'onboarding',
    settings: { quietHours: quiet },
    transitions: [{ from: null, to: 'onboarding', source: input.source, by: input.performedBy, at: new Date() }],
    provisionedBy: input.performedBy,
  });

  let credentialId: string | undefined;
  if (temporaryPassword) {
    credentialId = await storeCredential({
      collegeId: input.collegeId,
      accountId: String(account._id),
      runId: input.runId ?? null,
      source: input.source === 'bulk' ? 'bulk' : input.source === 'workflow' ? 'workflow' : 'admin',
      identifier: row.identifier,
      displayName: person.name,
      sectionId: row.sectionId ? String(row.sectionId) : undefined,
      batchId: row.batchId ? String(row.batchId) : undefined,
      departmentId: row.departmentId ? String(row.departmentId) : undefined,
      plaintext: temporaryPassword,
    });
  }

  await createAuditLog({
    collegeId: input.collegeId,
    entityType: 'JuviAccount',
    entityId: String(account._id),
    entityName: person.name,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'onboarding' }],
    performedBy: input.performedBy,
    studentId: input.kind === 'student' ? String(row.entityId) : undefined,
  });

  return { account, created: true, userCreated, credentialId };
}

export async function transitionAccount(account: IJuviAccount, to: AccountStatus, source: TransitionSource, by: string): Promise<IJuviAccount> {
  const from = account.status;
  if (from === to) return account;
  account.status = to;
  account.transitions.push({ from, to, source, by, at: new Date() });
  await account.save();
  await createAuditLog({
    collegeId: String(account.collegeId),
    entityType: 'JuviAccount',
    entityId: String(account._id),
    entityName: `${account.kind} account`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: from, newValue: to }],
    performedBy: by,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  return account;
}

export async function deactivateAccount(collegeId: string, accountId: string, source: TransitionSource, performedBy: string): Promise<IJuviAccount> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId });
  if (!account) throw notFound('Account');
  await transitionAccount(account, 'deactivated', source, performedBy);
  await User.updateOne({ _id: account.userId, collegeId }, { $set: { isActive: false } });
  await revokeOtherSessions(String(account._id), null, 'deactivated');
  await ChannelMembership.deleteMany({ collegeId, accountId: account._id });
  return account;
}

/** Convenience for hooks: provision only when the college has Juvi switched on. */
export async function provisionIfEnabled(input: ProvisionPersonInput): Promise<ProvisionPersonResult | null> {
  const cfg = await getJuviConfig(input.collegeId);
  if (!cfg?.enabled) return null;
  return provisionPerson(input);
}
```

```ts
// backend/src/__e2e__/factories/juvi.factory.ts
import supertest from 'supertest';
import type { Express } from 'express';
import { College, IJuviConfig } from '../../models/College';
import { Section } from '../../models';
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

export async function provisionTestStudent(fx: BaseFixtures, opts: { sectionId?: string; batchId?: string; branchId?: string } = {}) {
  const s = await createTestStudent(fx.collegeId, {
    batchId: opts.batchId ?? String(fx.batch._id),
    branchId: opts.branchId ?? String(fx.cseBranch._id),
    programmeId: String(fx.btech._id),
  });
  if (opts.sectionId) await Section.updateOne({ _id: opts.sectionId }, { $addToSet: { studentIds: s.student._id } });
  const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(s.person._id), kind: 'student', source: 'admin', performedBy: 'test' });
  const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
  return { ...s, account, tempPassword: cred!.password };
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
```

- [ ] **Step 4: Run the integration test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-provisioning.e2e.test.ts && npm run typecheck`
Expected: PASS (8 tests). Redis connection warnings in the log are expected and harmless.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/provisioning-service.ts backend/src/__e2e__/factories/juvi.factory.ts backend/src/__e2e__/modules/juvi-app-provisioning.e2e.test.ts
git commit -m "feat(juvi-app): idempotent account provisioning with credential store and deactivation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Auth service and routes

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/schemas.ts`, `backend/src/modules/juvi-app/accounts/auth-service.ts`, `backend/src/modules/juvi-app/accounts/auth-controller.ts`, `backend/src/modules/juvi-app/accounts/routes.ts`
- Modify: `backend/src/modules/juvi-app/routes.ts` (register the accounts router)
- Test: `backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts`

**Interfaces:**
- Consumes: Tasks 5–9.
- Produces:
  ```ts
  // schemas.ts
  export const deviceSchema, signInSchema, refreshSchema, changePasswordSchema;
  export const accountSummarySchema, signInResponseSchema, tokensResponseSchema;
  export type SignInInput = z.infer<typeof signInSchema>; export type AccountSummary = z.infer<typeof accountSummarySchema>;
  // auth-service.ts
  export function accountSummary(account: IJuviAccount, user: { mustChangePassword: boolean }): AccountSummary;
  export async function signIn(input: SignInInput): Promise<z.infer<typeof signInResponseSchema>>;
  export async function refresh(input: { refreshToken: string; deviceId: string }): Promise<SessionTokens>;
  export async function signOut(ctx: MobileContext): Promise<void>;
  export async function changePassword(ctx: MobileContext, currentPassword: string, newPassword: string): Promise<void>;
  // routes.ts
  export const accountsRouter: Router;   // mounted on v1Router at '/'
  ```

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { deactivateAccount } from '../../modules/juvi-app/accounts/provisioning-service';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId, { supportContact: { name: 'Exam Office', phone: '040-1' } }); });
afterAll(async () => { await cleanupTestApp(); });

async function signIn(identifier: string, password: string, device = TEST_DEVICE, collegeId = fx.collegeId) {
  return mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId, identifier, password, device });
}

describe('POST /auth/sign-in', () => {
  it('signs in with roll number + temporary password and flags must-change', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.accessExpiresIn).toBe(900);
    expect(res.body.account).toMatchObject({ kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingComplete: false, mustChangePassword: true });
    const session = await MobileSession.findOne({ accountId: s.account._id }).lean();
    expect(session?.deviceName).toBe('Test Phone');
  });

  it('accepts the email identifier for the same user', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.person.email, s.tempPassword).expect(200);
  });

  it('returns one identical 401 body for wrong password and unknown identifier', async () => {
    const s = await provisionTestStudent(fx);
    const a = await signIn(s.student.rollNumber, 'nope-nope-000').expect(401);
    const b = await signIn('DOESNOTEXIST', 'nope-nope-000').expect(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives ACCOUNT_DEACTIVATED only when the password is right', async () => {
    const s = await provisionTestStudent(fx);
    await deactivateAccount(fx.collegeId, String(s.account._id), 'admin', 'admin');
    const wrong = await signIn(s.student.rollNumber, 'bad-bad-000').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const right = await signIn(s.student.rollNumber, s.tempPassword).expect(403);
    expect(right.body.error).toMatchObject({ code: 'ACCOUNT_DEACTIVATED', supportContact: { name: 'Exam Office' } });
  });

  it('refuses an identifier from another college with the generic 401', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.student.rollNumber, s.tempPassword, TEST_DEVICE, '000000000000000000000099').expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('replaces an earlier session for the same device', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    await signIn(s.student.rollNumber, s.tempPassword).expect(200);
    const sessions = await MobileSession.find({ accountId: s.account._id }).lean();
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((x) => !x.revokedAt)).toHaveLength(1);
  });

  it('400 VALIDATION_FAILED on a missing device', async () => {
    const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier: 'x', password: 'y' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields[0].path).toBe('device');
  });
});

describe('refresh, sign-out, change-password', () => {
  it('rotates the refresh token and revokes on replay', async () => {
    const s = await provisionTestStudent(fx);
    const first = (await signIn(s.student.rollNumber, s.tempPassword)).body;
    const rotated = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    const replay = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
    expect(replay.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'token_reuse' });
    // The whole session is gone: the rotated token is dead too.
    await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: rotated.body.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
  });

  it('sign-out invalidates the next request', async () => {
    const s = await provisionTestStudent(fx);
    const { accessToken } = (await signIn(s.student.rollNumber, s.tempPassword)).body;
    await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(204);
    const res = await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(res.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'sign_out' });
  });

  it('change-password clears the flag, kills the temp password and other sessions, keeps this one', async () => {
    const s = await provisionTestStudent(fx);
    const phoneA = (await signIn(s.student.rollNumber, s.tempPassword)).body;
    const phoneB = (await signIn(s.student.rollNumber, s.tempPassword, { ...TEST_DEVICE, id: 'device-2' })).body;

    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: 'wrong', newPassword: 'longenough1' }).expect(401);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'short' }).expect(400);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'longenough1' }).expect(204);

    await signIn(s.student.rollNumber, s.tempPassword).expect(401);
    const again = await signIn(s.student.rollNumber, 'longenough1', { ...TEST_DEVICE, id: 'device-3' }).expect(200);
    expect(again.body.account.mustChangePassword).toBe(false);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/sign-out`).expect(204);      // A survived until now
    const b = await mobileClient(app, phoneB.accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(b.body.error.reason).toBe('password_changed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-auth.e2e.test.ts`
Expected: FAIL: every request returns 404 `NOT_FOUND` "Route not found".

- [ ] **Step 3: Implement schemas, service, controller, routes**

```ts
// backend/src/modules/juvi-app/accounts/schemas.ts
import { z } from 'zod';
import { HHMM } from '../../../models/juvi/JuviAccount';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const deviceSchema = z.object({
  id: z.string().min(8).max(128),
  name: z.string().min(1).max(80),
  platform: z.enum(['android', 'ios']),
  appVersion: z.string().min(1).max(32),
  osVersion: z.string().min(1).max(32),
});

export const signInSchema = z.object({
  collegeId: objectId,
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  device: deviceSchema,
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200), deviceId: z.string().min(8).max(128) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  // ≥ 8 chars, no forced character classes (PRD S01).
  newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
});

export const accountSummarySchema = z.object({
  id: z.string(),
  kind: z.enum(['student', 'faculty', 'staff']),
  status: z.enum(['onboarding', 'active', 'exiting', 'deactivated', 'alumni']),
  onboardingStep: z.number().int(),
  onboardingSteps: z.array(z.string()),
  onboardingComplete: z.boolean(),
  mustChangePassword: z.boolean(),
});
export type AccountSummary = z.infer<typeof accountSummarySchema>;

export const tokensResponseSchema = z.object({
  accessToken: z.string(), accessExpiresIn: z.number().int(), refreshToken: z.string(),
});
export const signInResponseSchema = tokensResponseSchema.extend({ account: accountSummarySchema });

export const settingsSchema = z.object({
  quietHours: z.object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) }),
  tiers: z.object({ important: z.boolean(), routine: z.boolean() }),
  language: z.enum(['en']),
});
export const settingsPatchSchema = z.object({
  quietHours: settingsSchema.shape.quietHours.optional(),
  // `.strict()` makes an `urgent` key a validation error rather than a silent drop.
  tiers: z.object({ important: z.boolean().optional(), routine: z.boolean().optional() }).strict().optional(),
  language: z.enum(['en']).optional(),
}).strict();

export const onboardingAdvanceSchema = z.object({ step: z.number().int().min(0).max(10) });
export const onboardingStateSchema = z.object({ onboardingStep: z.number().int(), onboardingSteps: z.array(z.string()), onboardingComplete: z.boolean() });

export const deviceRowSchema = z.object({
  sessionId: z.string(), deviceName: z.string(), platform: z.enum(['android', 'ios']),
  appVersion: z.string(), lastActiveAt: z.string(), isCurrent: z.boolean(),
});
export const devicesResponseSchema = z.object({ items: z.array(deviceRowSchema) });
```

```ts
// backend/src/modules/juvi-app/accounts/auth-service.ts
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../../../models/User';
import { JuviAccount, IJuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileApiError } from '../errors';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { resolveIdentifierToUser } from './identifier-resolver';
import { getCooldown, recordFailure, clearFailures } from './cooldown';
import { createSession, rotateSession, revokeSession, revokeOtherSessions, signAccessToken, SessionTokens } from './session-service';
import { SignInInput, AccountSummary, signInResponseSchema } from './schemas';
import { ONBOARDING_STEPS } from './onboarding';

/** bcrypt work happens even when no user matched, so timing does not reveal existence. */
const DUMMY_HASH = bcrypt.hashSync('juvi-dummy-password-for-timing', 10);
const invalidCredentials = () => new MobileApiError(401, 'INVALID_CREDENTIALS', 'That identifier or password is not right.');

export function accountSummary(account: IJuviAccount, user: { mustChangePassword?: boolean }): AccountSummary {
  return {
    id: String(account._id),
    kind: account.kind,
    status: account.status,
    onboardingStep: account.onboardingStep,
    onboardingSteps: [...ONBOARDING_STEPS],
    onboardingComplete: Boolean(account.onboardingCompletedAt),
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export async function signIn(input: SignInInput): Promise<z.infer<typeof signInResponseSchema>> {
  const cooldown = await getCooldown(input.collegeId, input.identifier);
  if (cooldown.blocked) {
    throw new MobileApiError(429, 'COOLDOWN', `Too many attempts. Try again in ${Math.ceil(cooldown.retryAfterSeconds / 60)} minutes.`, { retryAfterSeconds: cooldown.retryAfterSeconds });
  }

  const cfg = await getJuviConfig(input.collegeId);
  if (!cfg?.enabled) {
    throw new MobileApiError(503, 'INSTITUTION_PAUSED', 'Juvi is not available for your institution right now.', { message: 'Juvi is not available for your institution right now.' });
  }

  const user = await resolveIdentifierToUser(input.collegeId, input.identifier);
  const account = user ? await JuviAccount.findOne({ collegeId: input.collegeId, userId: user._id }) : null;
  const ok = await bcrypt.compare(input.password, user?.password ?? DUMMY_HASH);

  if (!user || !account || !ok) {
    await recordFailure(input.collegeId, input.identifier);
    if (user && !account) console.warn('[juvi-app] sign-in for a user without a JuviAccount', { userId: String(user._id) });
    throw invalidCredentials();
  }
  if (account.status === 'deactivated' || !user.isActive) {
    throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', 'This account is no longer active at your institution.', { supportContact: cfg.supportContact ?? null });
  }

  await clearFailures(input.collegeId, input.identifier);
  const { tokens } = await createSession({
    collegeId: input.collegeId, accountId: String(account._id), userId: String(user._id),
    role: user.role, kind: account.kind, device: input.device,
  });
  return { ...tokens, account: accountSummary(account, user) };
}

export async function refresh(input: { refreshToken: string; deviceId: string }): Promise<SessionTokens> {
  // rotateSession needs role/kind for the token it signs, but those are authoritative on the
  // account and user, not on the caller. Rotate first (validates + swaps the hash), then re-sign
  // the access token with the real values.
  const { session, tokens } = await rotateSession(input.refreshToken, input.deviceId, { role: 'pending', kind: 'student' });
  const account = await JuviAccount.findById(session.accountId).select('kind').lean();
  const user = await User.findById(session.userId).select('role').lean();
  if (!account || !user) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  return {
    ...tokens,
    accessToken: signAccessToken({ sub: String(session.userId), sid: String(session._id), aid: String(session.accountId), cid: String(session.collegeId), role: user.role, kind: account.kind }),
  };
}

export async function signOut(ctx: MobileContext): Promise<void> {
  await revokeSession(ctx.sessionId, 'sign_out');
}

export async function changePassword(ctx: MobileContext, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId });
  if (!user) throw new MobileApiError(401, 'SESSION_INVALIDATED', 'Please sign in again.', { reason: 'invalid' });
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new MobileApiError(401, 'INVALID_CREDENTIALS', 'Your current password is not right.');
  user.password = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeOtherSessions(ctx.accountId, ctx.sessionId, 'password_changed');
}
```

```ts
// backend/src/modules/juvi-app/accounts/onboarding.ts
/** Server-owned ordered step list. Sub-project 2 appends 'welcome_notice'. */
export const ONBOARDING_STEPS = ['identity', 'spaces', 'notifications'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
```

```ts
// backend/src/modules/juvi-app/accounts/auth-controller.ts
import { Request, Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { signInSchema, refreshSchema, changePasswordSchema } from './schemas';
import * as auth from './auth-service';

export async function signIn(req: Request, res: Response, next: NextFunction) {
  try { res.json(await auth.signIn(signInSchema.parse(req.body))); } catch (e) { next(e); }
}
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try { res.json(await auth.refresh(refreshSchema.parse(req.body))); } catch (e) { next(e); }
}
export async function signOut(req: MobileRequest, res: Response, next: NextFunction) {
  try { await auth.signOut(requireMobile(req)); res.status(204).end(); } catch (e) { next(e); }
}
export async function changePassword(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const body = changePasswordSchema.parse(req.body);
    await auth.changePassword(requireMobile(req), body.currentPassword, body.newPassword);
    res.status(204).end();
  } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/accounts/routes.ts
import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { signInLimiter } from '../middleware/rate-limits';
import * as authCtrl from './auth-controller';

export const accountsRouter = Router();

accountsRouter.post('/auth/sign-in', signInLimiter, authCtrl.signIn);
accountsRouter.post('/auth/refresh', authCtrl.refresh);
accountsRouter.post('/auth/sign-out', authenticateMobile, authCtrl.signOut);
accountsRouter.post('/auth/change-password', authenticateMobile, authCtrl.changePassword);
// Task 11 adds the /me routes below.
```

Modify `backend/src/modules/juvi-app/routes.ts`: register the router.

```ts
import { accountsRouter } from './accounts/routes';
// after `export const v1Router = Router();`
v1Router.use(accountsRouter);
```

- [ ] **Step 4: Run the integration test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-auth.e2e.test.ts && npm run typecheck`
Expected: PASS (10 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts
git commit -m "feat(juvi-app): sign-in, refresh, sign-out and change-password with cooldown and rotation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Me service and routes

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/me-service.ts`, `backend/src/modules/juvi-app/accounts/me-controller.ts`
- Modify: `backend/src/modules/juvi-app/accounts/routes.ts`, `backend/src/modules/juvi-app/accounts/schemas.ts` (add `meResponseSchema`)
- Test: `backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts`

**Interfaces:**
- Consumes: `MobileContext` (Task 8), `transitionAccount` (Task 9), `revokeSession`, `revokeOtherSessions` (Task 7), `uploadEntityPhoto`, `getEntityPhotoUrls` from `modules/people/photo-service`, `photoUpload`, `multerErrorHandler` from `modules/people/photo-controller`, `getJuviConfig` (Task 5).
- Produces:
  ```ts
  export async function getMe(ctx: MobileContext): Promise<MeResponse>;
  export async function updateSettings(ctx: MobileContext, patch: z.infer<typeof settingsPatchSchema>): Promise<Settings>;
  export async function advanceOnboarding(ctx: MobileContext, step: number): Promise<OnboardingState>;
  export async function listDevices(ctx: MobileContext): Promise<DeviceRow[]>;
  export async function revokeDevice(ctx: MobileContext, sessionId: string): Promise<void>;
  export async function revokeOtherDevices(ctx: MobileContext): Promise<number>;
  export async function uploadMyPhoto(ctx: MobileContext, buffer: Buffer, declaredMime?: string): Promise<{ photoUrl: string | null }>;
  ```
  `MeResponse` shape is the spec §10 `GET /me` body; `meResponseSchema` in `schemas.ts` defines it.

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { Student } from '../../models';
import { JuviAccount } from '../../models/juvi/JuviAccount';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId, { accentColor: '#0055aa' }); });
afterAll(async () => { await cleanupTestApp(); });

async function tokenFor(identifier: string, password: string, deviceId = TEST_DEVICE.id) {
  const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}

describe('GET /me', () => {
  it('returns the student identity card, settings and institution snapshot', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, t).get(`${V1}/me`).expect(200);
    expect(res.body.account).toMatchObject({ kind: 'student', onboardingSteps: ['identity', 'spaces', 'notifications'], mustChangePassword: true });
    expect(res.body.person.name).toBe(s.person.name);
    expect(res.body.student).toMatchObject({ rollNumber: s.student.rollNumber, programme: 'B.Tech', branch: 'CSE', batch: '2024 Batch', section: 'A', department: 'Computer Science', isLateralEntry: false, hostel: null });
    expect(res.body.faculty).toBeNull();
    expect(res.body.settings).toEqual({ quietHours: { start: '22:00', end: '07:00' }, tiers: { important: true, routine: true }, language: 'en' });
    expect(res.body.institution).toMatchObject({ name: 'JIT Test College', code: 'JIT-TEST', accentColor: '#0055aa' });
    expect(res.body.asOf).toBeTypeOf('string');
  });

  it('marks lateral entry and returns the faculty card for faculty', async () => {
    const s = await provisionTestStudent(fx);
    await Student.updateOne({ _id: s.student._id }, { $set: { studyYearAtAdmission: 2 } });
    const ts = await tokenFor(s.student.rollNumber, s.tempPassword);
    expect((await mobileClient(app, ts).get(`${V1}/me`)).body.student.isLateralEntry).toBe(true);

    const f = await provisionTestFaculty(fx);
    const tf = await tokenFor(f.faculty.employeeCode, f.tempPassword, 'device-f');
    const res = await mobileClient(app, tf).get(`${V1}/me`).expect(200);
    expect(res.body.student).toBeNull();
    expect(res.body.faculty).toMatchObject({ employeeCode: f.faculty.employeeCode, department: 'Computer Science', isHod: false });
  });
});

describe('settings and onboarding', () => {
  it('PATCH /me/settings persists and rejects an urgent toggle', async () => {
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    const ok = await mobileClient(app, t).patch(`${V1}/me/settings`).send({ quietHours: { start: '23:00', end: '06:30' }, tiers: { routine: false } }).expect(200);
    expect(ok.body).toEqual({ quietHours: { start: '23:00', end: '06:30' }, tiers: { important: true, routine: false }, language: 'en' });
    const bad = await mobileClient(app, t).patch(`${V1}/me/settings`).send({ tiers: { urgent: false } }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect((await mobileClient(app, t).get(`${V1}/me/settings`)).body.quietHours.start).toBe('23:00');
  });

  it('advance walks the steps in order and completes after the last', async () => {
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    const wrong = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 1 }).expect(400);
    expect(wrong.body.error).toMatchObject({ code: 'VALIDATION_FAILED', currentStep: 0 });
    for (const step of [0, 1]) {
      const r = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step }).expect(200);
      expect(r.body).toMatchObject({ onboardingStep: step + 1, onboardingComplete: false });
    }
    const done = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 2 }).expect(200);
    expect(done.body).toMatchObject({ onboardingStep: 3, onboardingComplete: true });
    const acct = await JuviAccount.findById(s.account._id).lean();
    expect(acct?.status).toBe('active');
    expect(acct?.onboardingCompletedAt).toBeInstanceOf(Date);
    // Re-sending the last step is idempotent.
    await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 2 }).expect(200);
  });
});

describe('devices', () => {
  it('lists devices with isCurrent, revokes one, revokes others', async () => {
    const s = await provisionTestStudent(fx);
    const a = await tokenFor(s.student.rollNumber, s.tempPassword, 'device-a');
    const b = await tokenFor(s.student.rollNumber, s.tempPassword, 'device-b');
    const c = await tokenFor(s.student.rollNumber, s.tempPassword, 'device-c');
    const list = await mobileClient(app, a).get(`${V1}/me/devices`).expect(200);
    expect(list.body.items).toHaveLength(3);
    expect(list.body.items.filter((d: any) => d.isCurrent)).toHaveLength(1);
    const bRow = list.body.items.find((d: any) => !d.isCurrent);
    await mobileClient(app, a).delete(`${V1}/me/devices/${bRow.sessionId}`).expect(204);
    await mobileClient(app, a).delete(`${V1}/me/devices/000000000000000000000001`).expect(404);
    const others = await mobileClient(app, a).post(`${V1}/me/devices/revoke-others`).expect(200);
    expect(others.body.revoked).toBe(1);
    await mobileClient(app, a).get(`${V1}/me/devices`).expect(200);
    for (const dead of [b, c]) {
      const r = await mobileClient(app, dead).get(`${V1}/me/devices`).expect(401);
      expect(['signed_out_elsewhere', 'admin']).toContain(r.body.error.reason);
    }
  });
});

describe('photo', () => {
  it('returns 503 when S3 is not configured and 400 with no file', async () => {
    delete process.env.AWS_S3_BUCKET;
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.student.rollNumber, s.tempPassword);
    await mobileClient(app, t).post(`${V1}/me/photo`).expect(400);
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8cfc0000000030001a1a0d2b70000000049454e44ae426082', 'hex');
    const res = await mobileClient(app, t).post(`${V1}/me/photo`).attach('file', png, { filename: 'p.png', contentType: 'image/png' });
    expect([503, 500]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-me.e2e.test.ts`
Expected: FAIL with 404 `NOT_FOUND` on `/me`.

- [ ] **Step 3: Implement**

Add to `backend/src/modules/juvi-app/accounts/schemas.ts`:

```ts
export const meResponseSchema = z.object({
  account: accountSummarySchema,
  person: z.object({ name: z.string(), firstName: z.string(), photoUrl: z.string().nullable() }),
  student: z.object({
    rollNumber: z.string().nullable(), programme: z.string().nullable(), branch: z.string().nullable(),
    batch: z.string().nullable(), section: z.string().nullable(), department: z.string().nullable(),
    hostel: z.string().nullable(), isLateralEntry: z.boolean(),
  }).nullable(),
  faculty: z.object({
    employeeCode: z.string(), designation: z.string(), department: z.string().nullable(), isHod: z.boolean(),
  }).nullable(),
  settings: settingsSchema,
  institution: z.object({
    name: z.string(), code: z.string(), logoUrl: z.string().nullable(), accentColor: z.string().nullable(),
    supportContact: z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional() }).nullable(),
    timezone: z.string(),
  }),
  asOf: z.string(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
```

```ts
// backend/src/modules/juvi-app/accounts/me-service.ts
import { z } from 'zod';
import { User } from '../../../models/User';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Batch } from '../../../models/academic-structure/Batch';
import { Section } from '../../../models/academic-structure/Section';
import { Department } from '../../../models/academic-structure/Department';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { isS3Configured, getPresignedUrl } from '../../../shared/s3/s3-client';
import { uploadEntityPhoto, getEntityPhotoUrls } from '../../people/photo-service';
import type { PersonEntityType } from '../../../shared/s3/s3-client';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { MobileApiError, notFound } from '../errors';
import { revokeSession, revokeOtherSessions } from './session-service';
import { transitionAccount } from './provisioning-service';
import { accountSummary } from './auth-service';
import { ONBOARDING_STEPS } from './onboarding';
import { MeResponse, settingsPatchSchema, settingsSchema, onboardingStateSchema, deviceRowSchema } from './schemas';

type Settings = z.infer<typeof settingsSchema>;
type OnboardingState = z.infer<typeof onboardingStateSchema>;
type DeviceRow = z.infer<typeof deviceRowSchema>;

const ENTITY_TYPE: Record<MobileContext['kind'], PersonEntityType> = { student: 'students', faculty: 'faculty', staff: 'staff' };
const entityIdOf = (ctx: MobileContext) => ctx.studentId ?? ctx.facultyId ?? ctx.staffId ?? '';

async function photoUrlFor(ctx: MobileContext): Promise<string | null> {
  if (!isS3Configured()) return null;
  try {
    const urls = await getEntityPhotoUrls(ENTITY_TYPE[ctx.kind], ctx.collegeId, entityIdOf(ctx), 'thumb');
    return urls.thumb?.url ?? null;
  } catch { return null; }
}

async function logoUrlFor(logoKey?: string): Promise<string | null> {
  if (!logoKey) return null;
  if (/^https?:\/\//.test(logoKey)) return logoKey;
  if (!isS3Configured()) return null;
  try { return (await getPresignedUrl(logoKey, { expiresIn: 86_400 })).url; } catch { return null; }
}

export async function getMe(ctx: MobileContext): Promise<MeResponse> {
  const [account, user, person, cfg] = await Promise.all([
    JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId }),
    User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId }).select('mustChangePassword role').lean(),
    Person.findOne({ _id: ctx.account.personId, collegeId: ctx.collegeId }).select('name').lean(),
    getJuviConfig(ctx.collegeId),
  ]);
  if (!account || !user || !person || !cfg) throw notFound('Account');

  let student: MeResponse['student'] = null;
  let faculty: MeResponse['faculty'] = null;

  if (account.kind === 'student' && account.studentId) {
    const s = await Student.findOne({ _id: account.studentId, collegeId: ctx.collegeId }).select('rollNumber programmeId branchId batchId studyYearAtAdmission').lean();
    if (s) {
      const [programme, branch, batch, section] = await Promise.all([
        s.programmeId ? Programme.findById(s.programmeId).select('name').lean() : null,
        s.branchId ? Branch.findById(s.branchId).select('name departmentId').lean() : null,
        s.batchId ? Batch.findById(s.batchId).select('name').lean() : null,
        Section.findOne({ collegeId: ctx.collegeId, studentIds: s._id }).select('name').lean(),
      ]);
      const department = branch?.departmentId ? await Department.findById(branch.departmentId).select('name').lean() : null;
      const allocation = await HostelAllocation.findOne({ collegeId: ctx.collegeId, studentId: s._id, status: 'active' }).select('roomId').lean();
      const room = allocation ? await HostelRoom.findById(allocation.roomId).select('blockId').lean() : null;
      const block = room ? await HostelBlock.findById(room.blockId).select('name').lean() : null;
      student = {
        rollNumber: s.rollNumber ?? null,
        programme: programme?.name ?? null,
        branch: branch?.name ?? null,
        batch: batch?.name ?? null,
        section: section?.name ?? null,
        department: department?.name ?? null,
        hostel: block?.name ?? null,
        isLateralEntry: (s.studyYearAtAdmission ?? 1) > 1,
      };
    }
  } else if (account.kind === 'faculty' && account.facultyId) {
    const f = await Faculty.findOne({ _id: account.facultyId, collegeId: ctx.collegeId }).select('employeeCode designation departmentId').lean();
    if (f) {
      const department = f.departmentId ? await Department.findById(f.departmentId).select('name').lean() : null;
      const isHod = Boolean(await Department.exists({ collegeId: ctx.collegeId, hodId: f._id }));
      faculty = { employeeCode: f.employeeCode, designation: f.designation, department: department?.name ?? null, isHod };
    }
  }

  return {
    account: accountSummary(account, user),
    person: { name: person.name, firstName: person.name.split(/\s+/)[0] ?? person.name, photoUrl: await photoUrlFor(ctx) },
    student,
    faculty,
    settings: account.settings as Settings,
    institution: {
      name: cfg.name, code: cfg.code, logoUrl: await logoUrlFor(cfg.logo), accentColor: cfg.accentColor ?? null,
      supportContact: cfg.supportContact ?? null, timezone: cfg.timezone,
    },
    asOf: new Date().toISOString(),
  };
}

export async function getSettings(ctx: MobileContext): Promise<Settings> {
  const account = await JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId }).select('settings').lean();
  if (!account) throw notFound('Account');
  return account.settings as Settings;
}

export async function updateSettings(ctx: MobileContext, patch: z.infer<typeof settingsPatchSchema>): Promise<Settings> {
  const set: Record<string, unknown> = {};
  if (patch.quietHours) set['settings.quietHours'] = patch.quietHours;
  if (patch.tiers?.important !== undefined) set['settings.tiers.important'] = patch.tiers.important;
  if (patch.tiers?.routine !== undefined) set['settings.tiers.routine'] = patch.tiers.routine;
  if (patch.language) set['settings.language'] = patch.language;
  const account = await JuviAccount.findOneAndUpdate({ _id: ctx.accountId, collegeId: ctx.collegeId }, { $set: set }, { new: true }).select('settings').lean();
  if (!account) throw notFound('Account');
  return account.settings as Settings;
}

export async function advanceOnboarding(ctx: MobileContext, step: number): Promise<OnboardingState> {
  const account = await JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId });
  if (!account) throw notFound('Account');
  const total = ONBOARDING_STEPS.length;
  const state = () => ({ onboardingStep: account.onboardingStep, onboardingSteps: [...ONBOARDING_STEPS], onboardingComplete: Boolean(account.onboardingCompletedAt) });

  if (account.onboardingCompletedAt && step === total - 1) return state();          // idempotent re-send of the last step
  if (step !== account.onboardingStep) {
    throw new MobileApiError(400, 'VALIDATION_FAILED', 'That step is out of order.', { currentStep: account.onboardingStep });
  }
  account.onboardingStep = step + 1;
  if (account.onboardingStep >= total) {
    account.onboardingCompletedAt = new Date();
    await account.save();
    if (account.status === 'onboarding') await transitionAccount(account, 'active', 'system', 'onboarding');
  } else {
    await account.save();
  }
  return state();
}

export async function listDevices(ctx: MobileContext): Promise<DeviceRow[]> {
  const rows = await MobileSession.find({ collegeId: ctx.collegeId, accountId: ctx.accountId, revokedAt: null }).sort({ lastActiveAt: -1 }).lean();
  return rows.map((r) => ({
    sessionId: String(r._id), deviceName: r.deviceName, platform: r.platform, appVersion: r.appVersion,
    lastActiveAt: r.lastActiveAt.toISOString(), isCurrent: String(r._id) === ctx.sessionId,
  }));
}

export async function revokeDevice(ctx: MobileContext, sessionId: string): Promise<void> {
  const row = await MobileSession.findOne({ _id: sessionId, collegeId: ctx.collegeId, accountId: ctx.accountId, revokedAt: null }).select('_id').lean();
  if (!row) throw notFound('Device');
  await revokeSession(sessionId, 'signed_out_elsewhere');
}

export async function revokeOtherDevices(ctx: MobileContext): Promise<number> {
  return revokeOtherSessions(ctx.accountId, ctx.sessionId, 'signed_out_elsewhere');
}

export async function uploadMyPhoto(ctx: MobileContext, buffer: Buffer, declaredMime?: string): Promise<{ photoUrl: string | null }> {
  await uploadEntityPhoto({ entityType: ENTITY_TYPE[ctx.kind], collegeId: ctx.collegeId, entityId: entityIdOf(ctx), buffer, declaredMime });
  return { photoUrl: await photoUrlFor(ctx) };
}
```

```ts
// backend/src/modules/juvi-app/accounts/me-controller.ts
import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { settingsPatchSchema, onboardingAdvanceSchema, objectId } from './schemas';
import * as me from './me-service';

export async function getMe(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.getMe(requireMobile(req))); } catch (e) { next(e); }
}
export async function getSettings(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.getSettings(requireMobile(req))); } catch (e) { next(e); }
}
export async function patchSettings(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.updateSettings(requireMobile(req), settingsPatchSchema.parse(req.body))); } catch (e) { next(e); }
}
export async function advanceOnboarding(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await me.advanceOnboarding(requireMobile(req), onboardingAdvanceSchema.parse(req.body).step)); } catch (e) { next(e); }
}
export async function listDevices(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json({ items: await me.listDevices(requireMobile(req)) }); } catch (e) { next(e); }
}
export async function revokeDevice(req: MobileRequest, res: Response, next: NextFunction) {
  try { await me.revokeDevice(requireMobile(req), objectId.parse(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
}
export async function revokeOtherDevices(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json({ revoked: await me.revokeOtherDevices(requireMobile(req)) }); } catch (e) { next(e); }
}
export async function uploadPhoto(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new MobileApiError(400, 'VALIDATION_FAILED', 'No file uploaded');
    res.json(await me.uploadMyPhoto(requireMobile(req), req.file.buffer, req.file.mimetype));
  } catch (e) { next(e); }
}
```

Append to `backend/src/modules/juvi-app/accounts/routes.ts`:

```ts
import { photoUpload, multerErrorHandler } from '../../people/photo-controller';
import * as meCtrl from './me-controller';

accountsRouter.get('/me', authenticateMobile, meCtrl.getMe);
accountsRouter.get('/me/settings', authenticateMobile, meCtrl.getSettings);
accountsRouter.patch('/me/settings', authenticateMobile, meCtrl.patchSettings);
accountsRouter.post('/me/onboarding/advance', authenticateMobile, meCtrl.advanceOnboarding);
accountsRouter.get('/me/devices', authenticateMobile, meCtrl.listDevices);
accountsRouter.delete('/me/devices/:id', authenticateMobile, meCtrl.revokeDevice);
accountsRouter.post('/me/devices/revoke-others', authenticateMobile, meCtrl.revokeOtherDevices);
accountsRouter.post('/me/photo', authenticateMobile, photoUpload.single('file'), multerErrorHandler, meCtrl.uploadPhoto);
```

- [ ] **Step 4: Run the integration test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-me.e2e.test.ts && npm run typecheck`
Expected: PASS (6 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/accounts backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts
git commit -m "feat(juvi-app): identity card, settings, server-driven onboarding, devices and photo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Channel templates and seed

**Files:**
- Create: `backend/src/modules/juvi-app/spaces/templates.ts`, `backend/src/shared/seed/channel-templates.ts`
- Test: `backend/src/modules/juvi-app/spaces/__tests__/templates.test.ts`, `backend/src/__e2e__/modules/juvi-app-templates.e2e.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TemplateDef { code: TemplateCode; name: string; namePattern: string; aboutPattern: string; scopeType: ChannelScopeType; membershipStrategy: TemplateCode; postingRule: 'publishers_only'; replyRule: ReplyRule; defaultPriority: ChannelPriority; archiveRule: ArchiveRule }
  export const DEFAULT_CHANNEL_TEMPLATES: readonly TemplateDef[];   // five, in spec §9 order
  export function renderPattern(pattern: string, vars: Record<string, string | undefined>): string;
  // shared/seed/channel-templates.ts
  export async function seedChannelTemplates(collegeId: string): Promise<{ created: number; existing: number }>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/juvi-app/spaces/__tests__/templates.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CHANNEL_TEMPLATES, renderPattern } from '../templates';

describe('channel templates', () => {
  it('ships the five templates with the spec rules', () => {
    expect(DEFAULT_CHANNEL_TEMPLATES.map((t) => t.code)).toEqual(['college', 'department', 'batch', 'course', 'hostel']);
    const byCode = Object.fromEntries(DEFAULT_CHANNEL_TEMPLATES.map((t) => [t.code, t]));
    expect(byCode.college).toMatchObject({ scopeType: 'college', replyRule: 'announcement_only', defaultPriority: 'important', archiveRule: 'never' });
    expect(byCode.course).toMatchObject({ scopeType: 'course_offering', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'on_semester_end' });
    expect(byCode.hostel.namePattern).toBe('{{block.name}} Hostel');
    for (const t of DEFAULT_CHANNEL_TEMPLATES) expect(t.membershipStrategy).toBe(t.code);
  });

  it('renders {{a.b}} tokens, collapses whitespace, blanks unknown tokens', () => {
    expect(renderPattern('{{course.code}} {{course.name}} · {{section.name}}', { 'course.code': 'CS201', 'course.name': 'DBMS', 'section.name': 'A' })).toBe('CS201 DBMS · A');
    expect(renderPattern('{{batch.code}} Batch', { 'batch.code': '2024' })).toBe('2024 Batch');
    expect(renderPattern('{{missing}} Hostel', {})).toBe('Hostel');
  });
});
```

```ts
// backend/src/__e2e__/modules/juvi-app-templates.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { ChannelTemplate } from '../../models/juvi/ChannelTemplate';
import { seedChannelTemplates } from '../../shared/seed/channel-templates';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('seedChannelTemplates', () => {
  it('inserts five rows once and preserves admin edits on re-run', async () => {
    expect(await seedChannelTemplates(fx.collegeId)).toEqual({ created: 5, existing: 0 });
    await ChannelTemplate.updateOne({ collegeId: fx.collegeId, code: 'batch' }, { $set: { replyRule: 'announcement_only' } });
    expect(await seedChannelTemplates(fx.collegeId)).toEqual({ created: 0, existing: 5 });
    expect((await ChannelTemplate.findOne({ collegeId: fx.collegeId, code: 'batch' }).lean())?.replyRule).toBe('announcement_only');
    expect(await ChannelTemplate.countDocuments({ collegeId: fx.collegeId })).toBe(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/spaces/__tests__/templates.test.ts; npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-templates.e2e.test.ts`
Expected: both FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/spaces/templates.ts
import { TemplateCode, ChannelScopeType, ReplyRule, ChannelPriority, ArchiveRule } from '../../../models/juvi/ChannelTemplate';

export interface TemplateDef {
  code: TemplateCode;
  name: string;
  namePattern: string;
  aboutPattern: string;
  scopeType: ChannelScopeType;
  membershipStrategy: TemplateCode;
  postingRule: 'publishers_only';
  replyRule: ReplyRule;
  defaultPriority: ChannelPriority;
  archiveRule: ArchiveRule;
}

/** Spec §9. D4: College is announcement-only; everything else allows replies. */
export const DEFAULT_CHANNEL_TEMPLATES: readonly TemplateDef[] = [
  { code: 'college', name: 'College', namePattern: '{{college.name}}', aboutPattern: 'Official notices and announcements for everyone at {{college.name}}. Published by the college office.', scopeType: 'college', membershipStrategy: 'college', postingRule: 'publishers_only', replyRule: 'announcement_only', defaultPriority: 'important', archiveRule: 'never' },
  { code: 'department', name: 'Department', namePattern: '{{department.name}}', aboutPattern: 'Everything from the {{department.name}} department. Published by the HOD and the office.', scopeType: 'department', membershipStrategy: 'department', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'important', archiveRule: 'never' },
  { code: 'batch', name: 'Batch', namePattern: '{{batch.code}} Batch', aboutPattern: 'Everything for the {{batch.code}} batch. Published by class coordinators, the HOD and the registrar.', scopeType: 'batch', membershipStrategy: 'batch', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'never' },
  { code: 'course', name: 'Course', namePattern: '{{course.code}} {{course.name}} · {{section.name}}', aboutPattern: '{{course.code}} {{course.name}} for section {{section.name}}. Published by the course faculty.', scopeType: 'course_offering', membershipStrategy: 'course', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'on_semester_end' },
  { code: 'hostel', name: 'Hostel', namePattern: '{{block.name}} Hostel', aboutPattern: 'Notices for residents of {{block.name}}. Published by the wardens.', scopeType: 'hostel_block', membershipStrategy: 'hostel', postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine', archiveRule: 'never' },
];

export function renderPattern(pattern: string, vars: Record<string, string | undefined>): string {
  return pattern
    .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

```ts
// backend/src/shared/seed/channel-templates.ts
import { ChannelTemplate } from '../../models/juvi/ChannelTemplate';
import { DEFAULT_CHANNEL_TEMPLATES } from '../../modules/juvi-app/spaces/templates';

/**
 * Idempotent: inserts any of the five templates the college lacks and never
 * overwrites an existing row, so admin edits (sub-project 6) survive re-seeds.
 */
export async function seedChannelTemplates(collegeId: string): Promise<{ created: number; existing: number }> {
  let created = 0; let existing = 0;
  for (const t of DEFAULT_CHANNEL_TEMPLATES) {
    const result = await ChannelTemplate.updateOne(
      { collegeId, code: t.code },
      { $setOnInsert: { ...t, collegeId, isEnabled: true } },
      { upsert: true },
    );
    if (result.upsertedCount && result.upsertedCount > 0) created += 1; else existing += 1;
  }
  return { created, existing };
}
```

- [ ] **Step 4: Run both tests**

Run: `cd backend && npx vitest run src/modules/juvi-app/spaces/__tests__/templates.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-templates.e2e.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/spaces backend/src/shared/seed/channel-templates.ts backend/src/__e2e__/modules/juvi-app-templates.e2e.test.ts
git commit -m "feat(juvi-app): five default channel templates and idempotent per-college seed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Membership strategies (pure)

**Files:**
- Create: `backend/src/modules/juvi-app/spaces/strategies.ts`
- Test: `backend/src/modules/juvi-app/spaces/__tests__/strategies.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AccountNode {
    accountId: string; kind: AccountKind; personId: string; isAdminOrPrincipal: boolean;
    student?: { studentId: string; batchId?: string; branchId?: string; sectionIds: string[]; enrolledOfferingIds: string[]; hostelBlockId?: string };
    faculty?: { facultyId: string; departmentId?: string; contractType: string };
    staff?: { staffId: string; personaCode?: string };
  }
  export interface ErpGraph {
    accounts: Map<string, AccountNode>;                                // accountId → node (eligible accounts only)
    branchDepartment: Map<string, string>;                             // branchId → departmentId
    departments: Map<string, { hodFacultyId?: string }>;
    sections: Map<string, { batchId: string; branchId: string; classAdvisorId?: string }>;
    offerings: Map<string, { sectionId: string; facultyIds: string[]; enrollmentCount: number }>;
    blocks: Map<string, { wardenPersonId?: string; chiefWardenStaffId?: string }>;
  }
  export interface ChannelRef { scopeType: ChannelScopeType; scopeId: string | null }
  export const F4_CONTRACT_TYPES: ReadonlySet<string>;   // adjunct, visiting
  export function computeExpectedMembers(graph: ErpGraph, channel: ChannelRef): Map<string, MembershipRole>;
  export function emptyGraph(): ErpGraph;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/spaces/__tests__/strategies.test.ts
import { describe, it, expect } from 'vitest';
import { computeExpectedMembers, emptyGraph, ErpGraph, AccountNode } from '../strategies';

function graph(): ErpGraph {
  const g = emptyGraph();
  g.branchDepartment.set('brCSE', 'dCSE'); g.branchDepartment.set('brECE', 'dECE');
  g.departments.set('dCSE', { hodFacultyId: 'fHOD' }); g.departments.set('dECE', {});
  g.sections.set('secA', { batchId: 'b24', branchId: 'brCSE', classAdvisorId: 'fADV' });
  g.sections.set('secE', { batchId: 'b24', branchId: 'brECE' });
  g.offerings.set('offDB', { sectionId: 'secA', facultyIds: ['fFAC', 'fCO'], enrollmentCount: 1 });
  g.offerings.set('offNoEnrol', { sectionId: 'secA', facultyIds: ['fFAC'], enrollmentCount: 0 });
  g.blocks.set('blkA', { wardenPersonId: 'pWARDEN', chiefWardenStaffId: 'stCHIEF' });
  const add = (n: AccountNode) => g.accounts.set(n.accountId, n);
  add({ accountId: 'aStu', kind: 'student', personId: 'pStu', isAdminOrPrincipal: false, student: { studentId: 'sStu', batchId: 'b24', branchId: 'brCSE', sectionIds: ['secA'], enrolledOfferingIds: ['offDB'], hostelBlockId: 'blkA' } });
  add({ accountId: 'aStu2', kind: 'student', personId: 'pStu2', isAdminOrPrincipal: false, student: { studentId: 'sStu2', batchId: 'b24', branchId: 'brCSE', sectionIds: ['secA'], enrolledOfferingIds: [] } });
  add({ accountId: 'aEce', kind: 'student', personId: 'pEce', isAdminOrPrincipal: false, student: { studentId: 'sEce', batchId: 'b24', branchId: 'brECE', sectionIds: ['secE'], enrolledOfferingIds: [] } });
  add({ accountId: 'aFac', kind: 'faculty', personId: 'pFac', isAdminOrPrincipal: false, faculty: { facultyId: 'fFAC', departmentId: 'dCSE', contractType: 'regular' } });
  add({ accountId: 'aCo', kind: 'faculty', personId: 'pCo', isAdminOrPrincipal: false, faculty: { facultyId: 'fCO', departmentId: 'dCSE', contractType: 'regular' } });
  add({ accountId: 'aHod', kind: 'faculty', personId: 'pHod', isAdminOrPrincipal: false, faculty: { facultyId: 'fHOD', departmentId: 'dCSE', contractType: 'regular' } });
  add({ accountId: 'aAdv', kind: 'faculty', personId: 'pAdv', isAdminOrPrincipal: false, faculty: { facultyId: 'fADV', departmentId: 'dECE', contractType: 'regular' } });
  add({ accountId: 'aAdj', kind: 'faculty', personId: 'pAdj', isAdminOrPrincipal: false, faculty: { facultyId: 'fADJ', departmentId: 'dCSE', contractType: 'adjunct' } });
  add({ accountId: 'aReg', kind: 'staff', personId: 'pReg', isAdminOrPrincipal: false, staff: { staffId: 'stREG', personaCode: 'ST-REG' } });
  add({ accountId: 'aAdm', kind: 'staff', personId: 'pAdm', isAdminOrPrincipal: false, staff: { staffId: 'stADM', personaCode: 'ST-ADM-TC' } });
  add({ accountId: 'aChief', kind: 'staff', personId: 'pChief', isAdminOrPrincipal: false, staff: { staffId: 'stCHIEF', personaCode: 'ST-WARDEN' } });
  add({ accountId: 'aWarden', kind: 'staff', personId: 'pWARDEN', isAdminOrPrincipal: false, staff: { staffId: 'stWARD' } });
  add({ accountId: 'aPrin', kind: 'staff', personId: 'pPrin', isAdminOrPrincipal: true, staff: { staffId: 'stPRIN' } });
  return g;
}
const roles = (m: Map<string, string>) => Object.fromEntries([...m.entries()].sort());

describe('computeExpectedMembers', () => {
  it('college: everyone except F4; admin/principal and staff publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'college', scopeId: null }));
    expect(m.aStu).toBe('member'); expect(m.aFac).toBe('member');
    expect(m.aAdj).toBeUndefined();
    expect(m.aReg).toBe('publisher'); expect(m.aPrin).toBe('publisher');
  });

  it('department: students via branch, faculty via department minus F4; HOD, principal, registrar publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'department', scopeId: 'dCSE' }));
    expect(m.aStu).toBe('member'); expect(m.aEce).toBeUndefined();
    expect(m.aFac).toBe('member'); expect(m.aAdv).toBeUndefined(); expect(m.aAdj).toBeUndefined();
    expect(m.aHod).toBe('publisher'); expect(m.aPrin).toBe('publisher'); expect(m.aReg).toBe('publisher');
    expect(m.aAdm).toBeUndefined();
  });

  it('batch: students by batch; admissions/registrar staff, class advisors and HODs of its branches publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'batch', scopeId: 'b24' }));
    expect(m.aStu).toBe('member'); expect(m.aEce).toBe('member');
    expect(m.aAdm).toBe('publisher'); expect(m.aReg).toBe('publisher');
    expect(m.aAdv).toBe('publisher'); expect(m.aHod).toBe('publisher');
    expect(m.aFac).toBeUndefined(); expect(m.aChief).toBeUndefined();
  });

  it('course: enrolled students; assigned faculty publish; section roster fallback when no enrollments', () => {
    const withEnrol = roles(computeExpectedMembers(graph(), { scopeType: 'course_offering', scopeId: 'offDB' }));
    expect(withEnrol).toEqual({ aStu: 'member', aFac: 'publisher', aCo: 'publisher' });
    const fallback = roles(computeExpectedMembers(graph(), { scopeType: 'course_offering', scopeId: 'offNoEnrol' }));
    expect(fallback).toEqual({ aStu: 'member', aStu2: 'member', aFac: 'publisher' });
  });

  it('hostel: residents; warden person and chief-warden staff publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'hostel_block', scopeId: 'blkA' }));
    expect(m).toEqual({ aStu: 'member', aWarden: 'publisher', aChief: 'publisher' });
  });

  it('unknown scope object yields nobody', () => {
    expect(computeExpectedMembers(graph(), { scopeType: 'department', scopeId: 'nope' }).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/spaces/__tests__/strategies.test.ts`
Expected: FAIL with "Cannot find module '../strategies'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/spaces/strategies.ts
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { ChannelScopeType } from '../../../models/juvi/ChannelTemplate';
import { MembershipRole } from '../../../models/juvi/ChannelMembership';

export interface AccountNode {
  accountId: string;
  kind: AccountKind;
  personId: string;
  isAdminOrPrincipal: boolean;
  student?: { studentId: string; batchId?: string; branchId?: string; sectionIds: string[]; enrolledOfferingIds: string[]; hostelBlockId?: string };
  faculty?: { facultyId: string; departmentId?: string; contractType: string };
  staff?: { staffId: string; personaCode?: string };
}

/**
 * In-memory view of the ERP for membership decisions. The college loader fills
 * `accounts` with every eligible account; the account loader fills it with one.
 * The metadata maps are college-wide in both cases (they are small).
 */
export interface ErpGraph {
  accounts: Map<string, AccountNode>;
  branchDepartment: Map<string, string>;
  departments: Map<string, { hodFacultyId?: string }>;
  sections: Map<string, { batchId: string; branchId: string; classAdvisorId?: string }>;
  offerings: Map<string, { sectionId: string; facultyIds: string[]; enrollmentCount: number }>;
  blocks: Map<string, { wardenPersonId?: string; chiefWardenStaffId?: string }>;
}

export interface ChannelRef { scopeType: ChannelScopeType; scopeId: string | null }

export const F4_CONTRACT_TYPES: ReadonlySet<string> = new Set(['adjunct', 'visiting']);

export function emptyGraph(): ErpGraph {
  return { accounts: new Map(), branchDepartment: new Map(), departments: new Map(), sections: new Map(), offerings: new Map(), blocks: new Map() };
}

const isF4 = (a: AccountNode) => a.kind === 'faculty' && F4_CONTRACT_TYPES.has(a.faculty?.contractType ?? '');
const isRegistrar = (a: AccountNode) => a.staff?.personaCode === 'ST-REG';
const isAdmissions = (a: AccountNode) => (a.staff?.personaCode ?? '').startsWith('ST-ADM');

function headsDepartment(g: ErpGraph, a: AccountNode, departmentId: string): boolean {
  return Boolean(a.faculty) && g.departments.get(departmentId)?.hodFacultyId === a.faculty!.facultyId;
}

function decide(g: ErpGraph, channel: ChannelRef, a: AccountNode): MembershipRole | null {
  const id = channel.scopeId ?? '';
  switch (channel.scopeType) {
    case 'college': {
      if (isF4(a)) return null;
      return a.isAdminOrPrincipal || a.kind === 'staff' ? 'publisher' : 'member';
    }
    case 'department': {
      if (!g.departments.has(id)) return null;
      if (a.isAdminOrPrincipal || isRegistrar(a) || headsDepartment(g, a, id)) return 'publisher';
      if (a.student?.branchId && g.branchDepartment.get(a.student.branchId) === id) return 'member';
      if (a.faculty?.departmentId === id && !isF4(a)) return 'member';
      return null;
    }
    case 'batch': {
      const sectionsOfBatch = [...g.sections.entries()].filter(([, s]) => s.batchId === id);
      if (isAdmissions(a) || isRegistrar(a)) return 'publisher';
      if (a.faculty) {
        const fid = a.faculty.facultyId;
        if (sectionsOfBatch.some(([, s]) => s.classAdvisorId === fid)) return 'publisher';               // D3
        if (sectionsOfBatch.some(([, s]) => headsDepartment(g, a, g.branchDepartment.get(s.branchId) ?? ''))) return 'publisher';
      }
      if (a.student?.batchId === id) return 'member';
      return null;
    }
    case 'course_offering': {
      const off = g.offerings.get(id);
      if (!off) return null;
      if (a.faculty && off.facultyIds.includes(a.faculty.facultyId)) return 'publisher';
      if (a.student) {
        if (a.student.enrolledOfferingIds.includes(id)) return 'member';
        if (off.enrollmentCount === 0 && a.student.sectionIds.includes(off.sectionId)) return 'member';   // roster fallback
      }
      return null;
    }
    case 'hostel_block': {
      const blk = g.blocks.get(id);
      if (!blk) return null;
      if (blk.wardenPersonId === a.personId) return 'publisher';
      if (a.staff && blk.chiefWardenStaffId === a.staff.staffId) return 'publisher';
      if (a.student?.hostelBlockId === id) return 'member';
      return null;
    }
    default:
      return null;
  }
}

/** One algorithm for both the college pass and the account pass (spec §9). */
export function computeExpectedMembers(graph: ErpGraph, channel: ChannelRef): Map<string, MembershipRole> {
  const out = new Map<string, MembershipRole>();
  for (const a of graph.accounts.values()) {
    const role = decide(graph, channel, a);
    if (role) out.set(a.accountId, role);
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `cd backend && npx vitest run src/modules/juvi-app/spaces/__tests__/strategies.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/spaces/strategies.ts backend/src/modules/juvi-app/spaces/__tests__/strategies.test.ts
git commit -m "feat(juvi-app): pure membership strategies over an in-memory ERP graph

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Graph loaders

**Files:**
- Create: `backend/src/modules/juvi-app/spaces/graph-loader.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-graph-loader.e2e.test.ts`

**Interfaces:**
- Consumes: `ErpGraph`, `AccountNode`, `emptyGraph` (Task 13); models.
- Produces:
  ```ts
  export interface ScopeObjects { departmentIds: string[]; batchIds: string[]; offerings: { id: string; semesterId: string; courseCode: string; courseName: string; sectionName: string }[]; blockIds: string[]; endedOfferingIds: string[] }
  export interface CollegeGraph extends ErpGraph { scopes: ScopeObjects; names: { departments: Map<string, string>; batches: Map<string, string>; blocks: Map<string, string>; college: string } }
  export async function loadCollegeGraph(collegeId: string): Promise<CollegeGraph>;
  export async function loadAccountGraph(collegeId: string, accountId: string): Promise<ErpGraph>;   // accounts has one entry (or none if ineligible)
  ```
  "Current" semester = `Semester.status === 'active'`. Active offerings = `CourseOffering.status === 'active'` in a current semester. Ended offerings = offerings whose semester is `completed`.

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-graph-loader.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { Department, Section, HostelBlock, HostelRoom, HostelAllocation } from '../../models';
import { loadCollegeGraph, loadAccountGraph } from '../../modules/juvi-app/spaces/graph-loader';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function scenario() {
  const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const fac = await provisionTestFaculty(fx);
  await Department.updateOne({ _id: fx.cse._id }, { $set: { hodId: fac.faculty._id } });
  await Section.updateOne({ _id: fx.cseSection._id }, { $set: { classAdvisorId: fac.faculty._id } });
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CS201', name: 'DBMS' });
  const active = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await active.updateOne({ $set: { status: 'active' } });
  const upcoming = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem2._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await upcoming.updateOne({ $set: { status: 'active' } });
  await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(active._id), semesterId: String(fx.sem1._id) });
  const block = await HostelBlock.create({ collegeId: fx.collegeId, name: 'Aravali', type: 'boys', totalRooms: 10, wardenId: fac.person._id });
  const room = await HostelRoom.create({ collegeId: fx.collegeId, blockId: block._id, roomNumber: '101', floor: 1, capacity: 2 });
  await HostelAllocation.create({ collegeId: fx.collegeId, studentId: stu.student._id, roomId: room._id, academicYearId: fx.ay._id, status: 'active' });
  return { stu, fac, active, upcoming, block };
}

describe('loadCollegeGraph', () => {
  it('loads eligible accounts, metadata maps and scope objects', async () => {
    const { stu, fac, active, upcoming, block } = await scenario();
    const g = await loadCollegeGraph(fx.collegeId);
    expect(g.accounts.size).toBe(2);
    const s = g.accounts.get(String(stu.account._id))!;
    expect(s.student).toMatchObject({ batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id), sectionIds: [String(fx.cseSection._id)], enrolledOfferingIds: [String(active._id)], hostelBlockId: String(block._id) });
    const f = g.accounts.get(String(fac.account._id))!;
    expect(f.faculty).toMatchObject({ facultyId: String(fac.faculty._id), departmentId: String(fx.cse._id), contractType: 'regular' });
    expect(g.branchDepartment.get(String(fx.cseBranch._id))).toBe(String(fx.cse._id));
    expect(g.departments.get(String(fx.cse._id))).toEqual({ hodFacultyId: String(fac.faculty._id) });
    expect(g.sections.get(String(fx.cseSection._id))).toMatchObject({ batchId: String(fx.batch._id), classAdvisorId: String(fac.faculty._id) });
    expect(g.offerings.get(String(active._id))).toEqual({ sectionId: String(fx.cseSection._id), facultyIds: [String(fac.faculty._id)], enrollmentCount: 1 });
    expect(g.offerings.has(String(upcoming._id))).toBe(false);          // sem2 is upcoming, not active
    expect(g.blocks.get(String(block._id))).toEqual({ wardenPersonId: String(fac.person._id), chiefWardenStaffId: undefined });
    expect(g.scopes.departmentIds.sort()).toEqual([String(fx.cse._id), String(fx.ece._id)].sort());
    expect(g.scopes.batchIds).toEqual([String(fx.batch._id)]);
    expect(g.scopes.offerings).toEqual([{ id: String(active._id), semesterId: String(fx.sem1._id), courseCode: 'CS201', courseName: 'DBMS', sectionName: 'A' }]);
    expect(g.scopes.blockIds).toEqual([String(block._id)]);
    expect(g.names.college).toBe('JIT Test College');
    expect(g.names.batches.get(String(fx.batch._id))).toBe('2024');
  });

  it('excludes deactivated accounts and lists ended offerings', async () => {
    const { stu, active } = await scenario();
    const { deactivateAccount } = await import('../../modules/juvi-app/accounts/provisioning-service');
    await deactivateAccount(fx.collegeId, String(stu.account._id), 'admin', 'x');
    await fx.sem1.updateOne({ $set: { status: 'completed' } });
    const g = await loadCollegeGraph(fx.collegeId);
    expect(g.accounts.has(String(stu.account._id))).toBe(false);
    expect(g.offerings.has(String(active._id))).toBe(false);
    expect(g.scopes.endedOfferingIds).toEqual([String(active._id)]);
  });
});

describe('loadAccountGraph', () => {
  it('loads one account with the same node shape and the college metadata', async () => {
    const { stu, active } = await scenario();
    const g = await loadAccountGraph(fx.collegeId, String(stu.account._id));
    expect(g.accounts.size).toBe(1);
    expect(g.accounts.get(String(stu.account._id))!.student!.enrolledOfferingIds).toEqual([String(active._id)]);
    expect(g.offerings.get(String(active._id))!.enrollmentCount).toBe(1);
    expect(g.departments.size).toBe(2);
  });

  it('returns no accounts for a deactivated or foreign account', async () => {
    const { stu } = await scenario();
    expect((await loadAccountGraph('000000000000000000000099', String(stu.account._id))).accounts.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-graph-loader.e2e.test.ts`
Expected: FAIL with "Cannot find module '../../modules/juvi-app/spaces/graph-loader'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/spaces/graph-loader.ts
import { Types } from 'mongoose';
import { College } from '../../../models/College';
import { User } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Branch } from '../../../models/academic-structure/Branch';
import { Department } from '../../../models/academic-structure/Department';
import { Batch } from '../../../models/academic-structure/Batch';
import { Section } from '../../../models/academic-structure/Section';
import { Semester } from '../../../models/academic-structure/Semester';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { JuviAccount, ELIGIBLE_STATUSES, IJuviAccount } from '../../../models/juvi/JuviAccount';
import { ErpGraph, AccountNode, emptyGraph } from './strategies';

export interface ScopeObjects {
  departmentIds: string[];
  batchIds: string[];
  offerings: { id: string; semesterId: string; courseCode: string; courseName: string; sectionName: string }[];
  blockIds: string[];
  endedOfferingIds: string[];
}

export interface CollegeGraph extends ErpGraph {
  scopes: ScopeObjects;
  names: { departments: Map<string, string>; batches: Map<string, string>; blocks: Map<string, string>; college: string };
}

const s = (v: unknown) => String(v);
const ADMIN_ROLES = new Set(['admin', 'principal', 'super_admin']);

/** College-wide metadata used by both loaders. Hundreds of documents at most. */
async function loadMetadata(collegeId: string, g: ErpGraph): Promise<{ activeSemesterIds: string[]; endedSemesterIds: string[]; offeringDocs: any[]; blockDocs: any[] }> {
  const [branches, departments, sections, semesters, blocks] = await Promise.all([
    Branch.find({ collegeId }).select('_id departmentId').lean(),
    Department.find({ collegeId, isActive: true }).select('_id hodId').lean(),
    Section.find({ collegeId }).select('_id batchId branchId classAdvisorId').lean(),
    Semester.find({ collegeId, status: { $in: ['active', 'completed'] } }).select('_id status').lean(),
    HostelBlock.find({ collegeId, isActive: true }).select('_id wardenId chiefWardenId').lean(),
  ]);
  for (const b of branches) if (b.departmentId) g.branchDepartment.set(s(b._id), s(b.departmentId));
  for (const d of departments) g.departments.set(s(d._id), { hodFacultyId: d.hodId ? s(d.hodId) : undefined });
  for (const sec of sections) g.sections.set(s(sec._id), { batchId: s(sec.batchId), branchId: s(sec.branchId), classAdvisorId: sec.classAdvisorId ? s(sec.classAdvisorId) : undefined });
  for (const b of blocks) g.blocks.set(s(b._id), { wardenPersonId: b.wardenId ? s(b.wardenId) : undefined, chiefWardenStaffId: b.chiefWardenId ? s(b.chiefWardenId) : undefined });

  const activeSemesterIds = semesters.filter((x) => x.status === 'active').map((x) => s(x._id));
  const endedSemesterIds = semesters.filter((x) => x.status === 'completed').map((x) => s(x._id));

  const offeringDocs = await CourseOffering.find({ collegeId, status: 'active', semesterId: { $in: activeSemesterIds } })
    .select('_id semesterId sectionId facultyId coFacultyIds courseId').lean();
  const counts = await Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { collegeId: new Types.ObjectId(collegeId), status: 'enrolled', courseOfferingId: { $in: offeringDocs.map((o) => o._id) } } },
    { $group: { _id: '$courseOfferingId', n: { $sum: 1 } } },
  ]);
  const countBy = new Map(counts.map((c) => [s(c._id), c.n]));
  for (const o of offeringDocs) {
    g.offerings.set(s(o._id), {
      sectionId: s(o.sectionId),
      facultyIds: [s(o.facultyId), ...(o.coFacultyIds ?? []).map(s)],
      enrollmentCount: countBy.get(s(o._id)) ?? 0,
    });
  }
  return { activeSemesterIds, endedSemesterIds, offeringDocs, blockDocs: blocks };
}

async function buildAccountNodes(collegeId: string, accounts: IJuviAccount[]): Promise<AccountNode[]> {
  const studentIds = accounts.filter((a) => a.studentId).map((a) => a.studentId!);
  const facultyIds = accounts.filter((a) => a.facultyId).map((a) => a.facultyId!);
  const staffIds = accounts.filter((a) => a.staffId).map((a) => a.staffId!);

  const [users, students, faculty, staff, sections, enrollments, allocations] = await Promise.all([
    User.find({ _id: { $in: accounts.map((a) => a.userId) } }).select('_id role').lean(),
    Student.find({ _id: { $in: studentIds } }).select('_id batchId branchId').lean(),
    Faculty.find({ _id: { $in: facultyIds } }).select('_id departmentId contractType').lean(),
    Staff.find({ _id: { $in: staffIds } }).select('_id personaCode').lean(),
    Section.find({ collegeId, studentIds: { $in: studentIds } }).select('_id studentIds').lean(),
    Enrollment.find({ collegeId, status: 'enrolled', studentId: { $in: studentIds } }).select('studentId courseOfferingId').lean(),
    HostelAllocation.find({ collegeId, status: 'active', studentId: { $in: studentIds } }).select('studentId roomId').lean(),
  ]);
  const roomIds = allocations.map((a) => a.roomId);
  const rooms = roomIds.length ? await HostelRoom.find({ _id: { $in: roomIds } }).select('_id blockId').lean() : [];
  const blockByRoom = new Map(rooms.map((r) => [s(r._id), s(r.blockId)]));

  const roleByUser = new Map(users.map((u) => [s(u._id), u.role]));
  const studentById = new Map(students.map((x) => [s(x._id), x]));
  const facultyById = new Map(faculty.map((x) => [s(x._id), x]));
  const staffById = new Map(staff.map((x) => [s(x._id), x]));
  const sectionsByStudent = new Map<string, string[]>();
  for (const sec of sections) for (const sid of sec.studentIds ?? []) sectionsByStudent.set(s(sid), [...(sectionsByStudent.get(s(sid)) ?? []), s(sec._id)]);
  const offeringsByStudent = new Map<string, string[]>();
  for (const e of enrollments) offeringsByStudent.set(s(e.studentId), [...(offeringsByStudent.get(s(e.studentId)) ?? []), s(e.courseOfferingId)]);
  const blockByStudent = new Map(allocations.map((a) => [s(a.studentId), blockByRoom.get(s(a.roomId))]));

  return accounts.map((a) => {
    const node: AccountNode = { accountId: s(a._id), kind: a.kind, personId: s(a.personId), isAdminOrPrincipal: ADMIN_ROLES.has(roleByUser.get(s(a.userId)) ?? '') };
    if (a.kind === 'student' && a.studentId) {
      const st = studentById.get(s(a.studentId));
      node.student = {
        studentId: s(a.studentId), batchId: st?.batchId ? s(st.batchId) : undefined, branchId: st?.branchId ? s(st.branchId) : undefined,
        sectionIds: sectionsByStudent.get(s(a.studentId)) ?? [], enrolledOfferingIds: offeringsByStudent.get(s(a.studentId)) ?? [],
        hostelBlockId: blockByStudent.get(s(a.studentId)),
      };
    } else if (a.kind === 'faculty' && a.facultyId) {
      const f = facultyById.get(s(a.facultyId));
      node.faculty = { facultyId: s(a.facultyId), departmentId: f?.departmentId ? s(f.departmentId) : undefined, contractType: f?.contractType ?? 'regular' };
    } else if (a.kind === 'staff' && a.staffId) {
      node.staff = { staffId: s(a.staffId), personaCode: staffById.get(s(a.staffId))?.personaCode ?? undefined };
    }
    return node;
  });
}

export async function loadCollegeGraph(collegeId: string): Promise<CollegeGraph> {
  const g = emptyGraph() as CollegeGraph;
  const { endedSemesterIds, offeringDocs } = await loadMetadata(collegeId, g);

  const accounts = await JuviAccount.find({ collegeId, status: { $in: ELIGIBLE_STATUSES } });
  for (const node of await buildAccountNodes(collegeId, accounts)) g.accounts.set(node.accountId, node);

  const [college, batches, departments, blocks, courses, sections, ended] = await Promise.all([
    College.findById(collegeId).select('name').lean(),
    Batch.find({ collegeId, isActive: true }).select('_id code').lean(),
    Department.find({ collegeId, isActive: true }).select('_id name').lean(),
    HostelBlock.find({ collegeId, isActive: true }).select('_id name').lean(),
    Course.find({ _id: { $in: offeringDocs.map((o) => o.courseId) } }).select('_id code name').lean(),
    Section.find({ _id: { $in: offeringDocs.map((o) => o.sectionId) } }).select('_id name').lean(),
    CourseOffering.find({ collegeId, semesterId: { $in: endedSemesterIds } }).select('_id').lean(),
  ]);
  const courseById = new Map(courses.map((c) => [s(c._id), c]));
  const sectionName = new Map(sections.map((x) => [s(x._id), x.name]));
  const batchesWithStudents = new Set([...g.accounts.values()].map((a) => a.student?.batchId).filter(Boolean) as string[]);

  g.scopes = {
    departmentIds: departments.map((d) => s(d._id)),
    batchIds: batches.map((b) => s(b._id)).filter((id) => batchesWithStudents.has(id)),
    offerings: offeringDocs.map((o) => ({
      id: s(o._id), semesterId: s(o.semesterId),
      courseCode: courseById.get(s(o.courseId))?.code ?? '', courseName: courseById.get(s(o.courseId))?.name ?? '',
      sectionName: sectionName.get(s(o.sectionId)) ?? '',
    })),
    blockIds: blocks.map((b) => s(b._id)),
    endedOfferingIds: ended.map((o) => s(o._id)),
  };
  g.names = {
    departments: new Map(departments.map((d) => [s(d._id), d.name])),
    batches: new Map(batches.map((b) => [s(b._id), b.code])),
    blocks: new Map(blocks.map((b) => [s(b._id), b.name])),
    college: college?.name ?? '',
  };
  return g;
}

export async function loadAccountGraph(collegeId: string, accountId: string): Promise<ErpGraph> {
  const g = emptyGraph();
  const account = await JuviAccount.findOne({ _id: accountId, collegeId, status: { $in: ELIGIBLE_STATUSES } });
  if (!account) return g;
  await loadMetadata(collegeId, g);
  for (const node of await buildAccountNodes(collegeId, [account])) g.accounts.set(node.accountId, node);
  return g;
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-graph-loader.e2e.test.ts && npm run typecheck`
Expected: PASS (4 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/spaces/graph-loader.ts backend/src/__e2e__/modules/juvi-app-graph-loader.e2e.test.ts
git commit -m "feat(juvi-app): college and single-account ERP graph loaders

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Reconcile service

**Files:**
- Create: `backend/src/modules/juvi-app/spaces/reconcile-service.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-reconcile.e2e.test.ts`

**Interfaces:**
- Consumes: `loadCollegeGraph`, `loadAccountGraph`, `CollegeGraph` (Task 14); `computeExpectedMembers` (Task 13); `renderPattern`, `seedChannelTemplates` (Task 12); models.
- Produces:
  ```ts
  export interface MembershipDiff { added: number; removed: number; roleChanged: number }
  export interface ReconcileSummary { at: string; durationMs: number; skipped: boolean; channels: { created: number; archived: number; unarchived: number; total: number }; memberships: MembershipDiff; errors: number }
  export async function ensureChannels(collegeId: string, g: CollegeGraph, templates: Map<TemplateCode, IChannelTemplate>): Promise<{ created: number; archived: number; unarchived: number }>;
  export async function reconcileCollege(collegeId: string): Promise<ReconcileSummary>;
  export async function reconcileAccount(collegeId: string, accountId: string): Promise<MembershipDiff>;
  export async function getLastReconcile(collegeId: string): Promise<ReconcileSummary | null>;
  ```
  Redis: lock `juvi:reconcile-lock:{cid}` (EX 240, NX), summary `juvi:reconcile-last:{cid}` (EX 7 days).

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-reconcile.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { Department, Section, HostelBlock, HostelRoom, HostelAllocation, Enrollment } from '../../models';
import { Channel } from '../../models/juvi/Channel';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { reconcileCollege, reconcileAccount } from '../../modules/juvi-app/spaces/reconcile-service';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function scenario() {
  const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const stu2 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const fac = await provisionTestFaculty(fx);
  await Department.updateOne({ _id: fx.cse._id }, { $set: { hodId: fac.faculty._id } });
  await Section.updateOne({ _id: fx.cseSection._id }, { $set: { classAdvisorId: fac.faculty._id } });
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CS201', name: 'DBMS' });
  const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await off.updateOne({ $set: { status: 'active' } });
  await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
  await createTestEnrollment(fx.collegeId, { studentId: String(stu2.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
  const block = await HostelBlock.create({ collegeId: fx.collegeId, name: 'Aravali', type: 'boys', totalRooms: 10, wardenId: fac.person._id });
  const room = await HostelRoom.create({ collegeId: fx.collegeId, blockId: block._id, roomNumber: '101', floor: 1, capacity: 2 });
  await HostelAllocation.create({ collegeId: fx.collegeId, studentId: stu.student._id, roomId: room._id, academicYearId: fx.ay._id, status: 'active' });
  return { stu, stu2, fac, off, block };
}
const roleOf = async (accountId: unknown, channel: any) => (await ChannelMembership.findOne({ accountId, channelId: channel._id }).lean())?.role ?? null;

describe('reconcileCollege', () => {
  it('creates one channel per scope object, names them, and applies memberships with roles', async () => {
    const { stu, fac, off, block } = await scenario();
    const summary = await reconcileCollege(fx.collegeId);
    expect(summary.skipped).toBe(false);
    expect(summary.channels).toEqual({ created: 6, archived: 0, unarchived: 0, total: 6 });
    expect(summary.errors).toBe(0);

    const byScope = async (scopeType: string, scopeId: unknown = null) => (await Channel.findOne({ collegeId: fx.collegeId, scopeType, scopeId }).lean())!;
    const college = await byScope('college'); const dept = await byScope('department', fx.cse._id);
    const batch = await byScope('batch', fx.batch._id); const courseCh = await byScope('course_offering', off._id); const hostel = await byScope('hostel_block', block._id);
    expect(college.name).toBe('JIT Test College'); expect(college.replyRule).toBe('announcement_only');
    expect(courseCh.name).toBe('CS201 DBMS · A'); expect(String(courseCh.semesterId)).toBe(String(fx.sem1._id));
    expect(batch.name).toBe('2024 Batch'); expect(hostel.name).toBe('Aravali Hostel');

    expect(await roleOf(stu.account._id, college)).toBe('member');
    expect(await roleOf(stu.account._id, dept)).toBe('member');
    expect(await roleOf(stu.account._id, courseCh)).toBe('member');
    expect(await roleOf(stu.account._id, hostel)).toBe('member');
    expect(await roleOf(fac.account._id, dept)).toBe('publisher');       // HOD
    expect(await roleOf(fac.account._id, batch)).toBe('publisher');      // class advisor
    expect(await roleOf(fac.account._id, courseCh)).toBe('publisher');   // teaches
    expect(await roleOf(fac.account._id, hostel)).toBe('publisher');     // warden
    expect(await roleOf(fac.account._id, await byScope('department', fx.ece._id))).toBeNull();
    expect(courseCh.memberCount).toBe(3);
    expect(summary.memberships.added).toBe(await ChannelMembership.countDocuments({ collegeId: fx.collegeId }));
    expect((await JuviAccount.findById(stu.account._id).lean())?.lastReconciledAt).toBeInstanceOf(Date);
  });

  it('is idempotent and archives course channels when the semester completes', async () => {
    const { off } = await scenario();
    await reconcileCollege(fx.collegeId);
    const again = await reconcileCollege(fx.collegeId);
    expect(again.channels).toEqual({ created: 0, archived: 0, unarchived: 0, total: 6 });
    expect(again.memberships).toEqual({ added: 0, removed: 0, roleChanged: 0 });

    await fx.sem1.updateOne({ $set: { status: 'completed' } });
    const after = await reconcileCollege(fx.collegeId);
    expect(after.channels.archived).toBe(1);
    const ch = await Channel.findOne({ scopeId: off._id }).lean();
    expect(ch?.status).toBe('archived');
    expect(ch?.archivedAt).toBeInstanceOf(Date);
    expect(await ChannelMembership.countDocuments({ channelId: ch!._id })).toBe(3);   // memberships kept, read-only

    await fx.sem1.updateOne({ $set: { status: 'active' } });
    expect((await reconcileCollege(fx.collegeId)).channels.unarchived).toBe(1);
  });

  it('demotes a role when the HOD changes', async () => {
    const { fac } = await scenario();
    await reconcileCollege(fx.collegeId);
    await Department.updateOne({ _id: fx.cse._id }, { $unset: { hodId: 1 } });
    const s = await reconcileCollege(fx.collegeId);
    expect(s.memberships.roleChanged).toBeGreaterThanOrEqual(1);
    const dept = await Channel.findOne({ scopeType: 'department', scopeId: fx.cse._id }).lean();
    expect(await roleOf(fac.account._id, dept)).toBe('member');
  });
});

describe('reconcileAccount', () => {
  it('adds and removes only that account\'s memberships after an ERP change', async () => {
    const { stu, stu2, off } = await scenario();
    await reconcileCollege(fx.collegeId);
    await Enrollment.updateOne({ studentId: stu.student._id, courseOfferingId: off._id }, { $set: { status: 'dropped' } });
    const diff = await reconcileAccount(fx.collegeId, String(stu.account._id));
    expect(diff).toEqual({ added: 0, removed: 1, roleChanged: 0 });
    const ch = await Channel.findOne({ scopeId: off._id }).lean();
    expect(await roleOf(stu.account._id, ch)).toBeNull();
    expect(await roleOf(stu2.account._id, ch)).toBe('member');
    expect((await Channel.findById(ch!._id).lean())?.memberCount).toBe(2);

    await Enrollment.updateOne({ studentId: stu.student._id, courseOfferingId: off._id }, { $set: { status: 'enrolled' } });
    expect(await reconcileAccount(fx.collegeId, String(stu.account._id))).toEqual({ added: 1, removed: 0, roleChanged: 0 });
  });

  it('does nothing for a foreign or deactivated account', async () => {
    const { stu } = await scenario();
    await reconcileCollege(fx.collegeId);
    expect(await reconcileAccount('000000000000000000000099', String(stu.account._id))).toEqual({ added: 0, removed: 0, roleChanged: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-reconcile.e2e.test.ts`
Expected: FAIL with "Cannot find module '../../modules/juvi-app/spaces/reconcile-service'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/spaces/reconcile-service.ts
import { Types } from 'mongoose';
import redis from '../../../config/redis';
import { Channel } from '../../../models/juvi/Channel';
import { ChannelMembership, MembershipRole } from '../../../models/juvi/ChannelMembership';
import { ChannelTemplate, IChannelTemplate, TemplateCode, ChannelScopeType } from '../../../models/juvi/ChannelTemplate';
import { JuviAccount, ELIGIBLE_STATUSES } from '../../../models/juvi/JuviAccount';
import { seedChannelTemplates } from '../../../shared/seed/channel-templates';
import { loadCollegeGraph, loadAccountGraph, CollegeGraph } from './graph-loader';
import { computeExpectedMembers } from './strategies';
import { renderPattern } from './templates';

export interface MembershipDiff { added: number; removed: number; roleChanged: number }
export interface ReconcileSummary {
  at: string;
  durationMs: number;
  skipped: boolean;
  channels: { created: number; archived: number; unarchived: number; total: number };
  memberships: MembershipDiff;
  errors: number;
}

const LOCK_TTL_SECONDS = 240;
const SUMMARY_TTL_SECONDS = 7 * 86_400;
const lockKey = (cid: string) => `juvi:reconcile-lock:${cid}`;
const lastKey = (cid: string) => `juvi:reconcile-last:${cid}`;
const scopeKey = (scopeType: string, scopeId: unknown) => `${scopeType}:${scopeId ? String(scopeId) : ''}`;

async function loadTemplates(collegeId: string): Promise<Map<TemplateCode, IChannelTemplate>> {
  await seedChannelTemplates(collegeId);
  const rows = await ChannelTemplate.find({ collegeId, isEnabled: true }).lean();
  return new Map(rows.map((t) => [t.code, t as unknown as IChannelTemplate]));
}

interface DesiredChannel { code: TemplateCode; scopeType: ChannelScopeType; scopeId: string | null; semesterId?: string; vars: Record<string, string> }

function desiredChannels(g: CollegeGraph, templates: Map<TemplateCode, IChannelTemplate>): DesiredChannel[] {
  const out: DesiredChannel[] = [];
  if (templates.has('college')) out.push({ code: 'college', scopeType: 'college', scopeId: null, vars: { 'college.name': g.names.college } });
  if (templates.has('department')) for (const id of g.scopes.departmentIds) out.push({ code: 'department', scopeType: 'department', scopeId: id, vars: { 'department.name': g.names.departments.get(id) ?? '' } });
  if (templates.has('batch')) for (const id of g.scopes.batchIds) out.push({ code: 'batch', scopeType: 'batch', scopeId: id, vars: { 'batch.code': g.names.batches.get(id) ?? '' } });
  if (templates.has('course')) for (const o of g.scopes.offerings) out.push({ code: 'course', scopeType: 'course_offering', scopeId: o.id, semesterId: o.semesterId, vars: { 'course.code': o.courseCode, 'course.name': o.courseName, 'section.name': o.sectionName } });
  if (templates.has('hostel')) for (const id of g.scopes.blockIds) out.push({ code: 'hostel', scopeType: 'hostel_block', scopeId: id, vars: { 'block.name': g.names.blocks.get(id) ?? '' } });
  return out;
}

export async function ensureChannels(
  collegeId: string, g: CollegeGraph, templates: Map<TemplateCode, IChannelTemplate>,
): Promise<{ created: number; archived: number; unarchived: number }> {
  const existing = await Channel.find({ collegeId }).select('_id scopeType scopeId status').lean();
  const byKey = new Map(existing.map((c) => [scopeKey(c.scopeType, c.scopeId), c]));
  let created = 0; let unarchived = 0; let archived = 0;

  for (const d of desiredChannels(g, templates)) {
    const t = templates.get(d.code)!;
    const found = byKey.get(scopeKey(d.scopeType, d.scopeId));
    if (!found) {
      await Channel.create({
        collegeId, type: 'official', templateCode: d.code, scopeType: d.scopeType,
        scopeId: d.scopeId ? new Types.ObjectId(d.scopeId) : null, semesterId: d.semesterId,
        name: renderPattern(t.namePattern, d.vars) || t.name, about: renderPattern(t.aboutPattern, d.vars),
        postingRule: t.postingRule, replyRule: t.replyRule, defaultPriority: t.defaultPriority, createdVia: 'reconcile',
      });
      created += 1;
    } else if (found.status === 'archived') {
      await Channel.updateOne({ _id: found._id }, { $set: { status: 'active' }, $unset: { archivedAt: 1 } });
      unarchived += 1;
    }
  }

  if (g.scopes.endedOfferingIds.length) {
    const res = await Channel.updateMany(
      { collegeId, scopeType: 'course_offering', status: 'active', scopeId: { $in: g.scopes.endedOfferingIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'archived', archivedAt: new Date() } },
    );
    archived = res.modifiedCount;
  }
  return { created, archived, unarchived };
}

async function applyDiff(
  collegeId: string, channelId: Types.ObjectId,
  expected: Map<string, MembershipRole>, existing: { accountId: string; role: MembershipRole }[],
): Promise<MembershipDiff> {
  const existingByAccount = new Map(existing.map((m) => [m.accountId, m.role]));
  const ops: Parameters<typeof ChannelMembership.bulkWrite>[0] = [];
  const diff: MembershipDiff = { added: 0, removed: 0, roleChanged: 0 };

  for (const [accountId, role] of expected) {
    const had = existingByAccount.get(accountId);
    if (!had) { ops.push({ insertOne: { document: { collegeId, channelId, accountId: new Types.ObjectId(accountId), role, joinedVia: 'rule', joinedAt: new Date() } } }); diff.added += 1; }
    else if (had !== role) { ops.push({ updateOne: { filter: { channelId, accountId: new Types.ObjectId(accountId) }, update: { $set: { role } } } }); diff.roleChanged += 1; }
  }
  for (const accountId of existingByAccount.keys()) {
    if (!expected.has(accountId)) { ops.push({ deleteOne: { filter: { channelId, accountId: new Types.ObjectId(accountId) } } }); diff.removed += 1; }
  }
  if (ops.length) await ChannelMembership.bulkWrite(ops, { ordered: false });
  return diff;
}

export async function reconcileCollege(collegeId: string): Promise<ReconcileSummary> {
  const started = Date.now();
  const empty: ReconcileSummary = { at: new Date().toISOString(), durationMs: 0, skipped: true, channels: { created: 0, archived: 0, unarchived: 0, total: 0 }, memberships: { added: 0, removed: 0, roleChanged: 0 }, errors: 0 };
  let locked = false;
  try {
    const ok = await redis.set(lockKey(collegeId), '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (ok !== 'OK') return empty;
    locked = true;
  } catch { /* Redis down: run unlocked */ }

  try {
    const templates = await loadTemplates(collegeId);
    const g = await loadCollegeGraph(collegeId);
    const ch = await ensureChannels(collegeId, g, templates);
    const channels = await Channel.find({ collegeId, status: 'active' }).select('_id scopeType scopeId').lean();
    const memberships: MembershipDiff = { added: 0, removed: 0, roleChanged: 0 };
    let errors = 0;

    for (const c of channels) {
      try {
        const expected = computeExpectedMembers(g, { scopeType: c.scopeType, scopeId: c.scopeId ? String(c.scopeId) : null });
        const existing = (await ChannelMembership.find({ channelId: c._id }).select('accountId role').lean())
          .map((m) => ({ accountId: String(m.accountId), role: m.role }));
        const d = await applyDiff(collegeId, c._id, expected, existing);
        memberships.added += d.added; memberships.removed += d.removed; memberships.roleChanged += d.roleChanged;
        await Channel.updateOne({ _id: c._id }, { $set: { memberCount: expected.size } });
      } catch (err) {
        errors += 1;
        console.error('[juvi-app] reconcile failed for channel', String(c._id), err);
      }
    }

    await JuviAccount.updateMany({ collegeId, status: { $in: ELIGIBLE_STATUSES } }, { $set: { lastReconciledAt: new Date() } });
    const summary: ReconcileSummary = {
      at: new Date().toISOString(), durationMs: Date.now() - started, skipped: false,
      channels: { ...ch, total: await Channel.countDocuments({ collegeId }) }, memberships, errors,
    };
    try { await redis.set(lastKey(collegeId), JSON.stringify(summary), 'EX', SUMMARY_TTL_SECONDS); } catch { /* non-fatal */ }
    console.log(`[juvi-app] reconcile ${collegeId}: ${summary.channels.total} channels, +${memberships.added}/-${memberships.removed}/~${memberships.roleChanged} memberships, ${errors} errors, ${summary.durationMs}ms`);
    return summary;
  } finally {
    if (locked) { try { await redis.del(lockKey(collegeId)); } catch { /* non-fatal */ } }
  }
}

export async function reconcileAccount(collegeId: string, accountId: string): Promise<MembershipDiff> {
  const diff: MembershipDiff = { added: 0, removed: 0, roleChanged: 0 };
  const g = await loadAccountGraph(collegeId, accountId);
  if (g.accounts.size === 0) return diff;

  const channels = await Channel.find({ collegeId, status: 'active' }).select('_id scopeType scopeId').lean();
  const existing = new Map(
    (await ChannelMembership.find({ collegeId, accountId }).select('channelId role').lean()).map((m) => [String(m.channelId), m.role]),
  );
  const touched: Types.ObjectId[] = [];
  const ops: Parameters<typeof ChannelMembership.bulkWrite>[0] = [];
  const acct = new Types.ObjectId(accountId);

  for (const c of channels) {
    const want = computeExpectedMembers(g, { scopeType: c.scopeType, scopeId: c.scopeId ? String(c.scopeId) : null }).get(accountId);
    const have = existing.get(String(c._id));
    if (want && !have) { ops.push({ insertOne: { document: { collegeId, channelId: c._id, accountId: acct, role: want, joinedVia: 'rule', joinedAt: new Date() } } }); diff.added += 1; touched.push(c._id); }
    else if (!want && have) { ops.push({ deleteOne: { filter: { channelId: c._id, accountId: acct } } }); diff.removed += 1; touched.push(c._id); }
    else if (want && have && want !== have) { ops.push({ updateOne: { filter: { channelId: c._id, accountId: acct }, update: { $set: { role: want } } } }); diff.roleChanged += 1; }
  }
  if (ops.length) await ChannelMembership.bulkWrite(ops, { ordered: false });
  for (const id of touched) {
    await Channel.updateOne({ _id: id }, { $set: { memberCount: await ChannelMembership.countDocuments({ channelId: id }) } });
  }
  await JuviAccount.updateOne({ _id: accountId }, { $set: { lastReconciledAt: new Date() } });
  return diff;
}

export async function getLastReconcile(collegeId: string): Promise<ReconcileSummary | null> {
  try {
    const raw = await redis.get(lastKey(collegeId));
    return raw ? (JSON.parse(raw) as ReconcileSummary) : null;
  } catch { return null; }
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-reconcile.e2e.test.ts && npm run typecheck`
Expected: PASS (5 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/spaces/reconcile-service.ts backend/src/__e2e__/modules/juvi-app-reconcile.e2e.test.ts
git commit -m "feat(juvi-app): channel lifecycle and membership reconciliation for a college or one account

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Next-class computation

**Files:**
- Create: `backend/src/modules/juvi-app/spaces/next-class.ts`
- Test: `backend/src/modules/juvi-app/spaces/__tests__/next-class.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface WeeklySlot { day: string; startTime: string }          // 'monday'…'saturday', 'HH:MM'
  export function nextOccurrence(slots: WeeklySlot[], now: Date, timezone: string): Date | null;
  export function formatNextClassLabel(at: Date, now: Date, timezone: string): string;   // "Next: Today 11:00" | "Next: Tomorrow 09:00" | "Next: Fri 14:00"
  export async function nextClassByOffering(collegeId: string, offeringIds: string[], timezone: string): Promise<Map<string, Date>>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/spaces/__tests__/next-class.test.ts
import { describe, it, expect } from 'vitest';
import { nextOccurrence, formatNextClassLabel } from '../next-class';

// 2026-09-22T04:30:00Z is Tuesday 10:00 in Asia/Kolkata.
const NOW = new Date('2026-09-22T04:30:00Z');
const TZ = 'Asia/Kolkata';

describe('nextOccurrence', () => {
  it('picks the earliest future slot across the week', () => {
    const at = nextOccurrence([{ day: 'friday', startTime: '14:00' }, { day: 'wednesday', startTime: '09:00' }], NOW, TZ);
    expect(at?.toISOString()).toBe('2026-09-23T03:30:00.000Z');
  });
  it('a slot later today wins over tomorrow', () => {
    expect(nextOccurrence([{ day: 'tuesday', startTime: '11:00' }, { day: 'wednesday', startTime: '08:00' }], NOW, TZ)?.toISOString()).toBe('2026-09-22T05:30:00.000Z');
  });
  it('a slot earlier today rolls to next week; a slot starting now counts as now', () => {
    expect(nextOccurrence([{ day: 'tuesday', startTime: '09:00' }], NOW, TZ)?.toISOString()).toBe('2026-09-29T03:30:00.000Z');
    expect(nextOccurrence([{ day: 'tuesday', startTime: '10:00' }], NOW, TZ)?.toISOString()).toBe('2026-09-22T04:30:00.000Z');
  });
  it('ignores malformed slots and returns null when nothing is usable', () => {
    expect(nextOccurrence([{ day: 'funday', startTime: '10:00' }, { day: 'monday', startTime: 'x' }], NOW, TZ)).toBeNull();
    expect(nextOccurrence([], NOW, TZ)).toBeNull();
  });
});

describe('formatNextClassLabel', () => {
  it('says Today, Tomorrow, or the weekday', () => {
    expect(formatNextClassLabel(new Date('2026-09-22T05:30:00Z'), NOW, TZ)).toBe('Next: Today 11:00');
    expect(formatNextClassLabel(new Date('2026-09-23T03:30:00Z'), NOW, TZ)).toBe('Next: Tomorrow 09:00');
    expect(formatNextClassLabel(new Date('2026-09-25T08:30:00Z'), NOW, TZ)).toBe('Next: Fri 14:00');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/spaces/__tests__/next-class.test.ts`
Expected: FAIL with "Cannot find module '../next-class'".

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/spaces/next-class.ts
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';

export interface WeeklySlot { day: string; startTime: string }

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTES_PER_WEEK = 7 * 1440;

function zonedNow(now: Date, timezone: string): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dayIndex = SHORT.indexOf(get('weekday'));
  const minutes = (Number.parseInt(get('hour'), 10) % 24) * 60 + Number.parseInt(get('minute'), 10);
  return { dayIndex, minutes };
}

/** Earliest occurrence at or after `now` of any weekly slot, as an instant. IST has no DST, so minute arithmetic is exact. */
export function nextOccurrence(slots: WeeklySlot[], now: Date, timezone: string): Date | null {
  const { dayIndex, minutes } = zonedNow(now, timezone);
  let best = Number.POSITIVE_INFINITY;
  for (const s of slots) {
    const d = DAYS.indexOf(s.day.toLowerCase());
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.startTime);
    if (d < 0 || !m) continue;
    const slotMinutes = Number(m[1]) * 60 + Number(m[2]);
    let delta = ((d - dayIndex + 7) % 7) * 1440 + (slotMinutes - minutes);
    if (delta < 0) delta += MINUTES_PER_WEEK;
    if (delta < best) best = delta;
  }
  return Number.isFinite(best) ? new Date(now.getTime() + best * 60_000) : null;
}

export function formatNextClassLabel(at: Date, now: Date, timezone: string): string {
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  const today = dayKey(now); const tomorrow = dayKey(new Date(now.getTime() + 86_400_000)); const target = dayKey(at);
  const word = target === today ? 'Today' : target === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(at);
  return `Next: ${word} ${time}`;
}

/** Next class per offering from published weekly timetables. Offerings with no usable slot are absent from the map. */
export async function nextClassByOffering(collegeId: string, offeringIds: string[], timezone: string): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (offeringIds.length === 0) return out;
  const published = await Timetable.find({ collegeId, status: 'published' }).select('_id').lean();
  if (published.length === 0) return out;
  const slots = await TimetableSlot.find({
    collegeId, timetableId: { $in: published.map((t) => t._id) }, courseOfferingId: { $in: offeringIds }, slotType: { $ne: 'free' },
  }).select('courseOfferingId day startTime').lean();
  const byOffering = new Map<string, WeeklySlot[]>();
  for (const s of slots) byOffering.set(String(s.courseOfferingId), [...(byOffering.get(String(s.courseOfferingId)) ?? []), { day: s.day, startTime: s.startTime }]);
  const now = new Date();
  for (const [id, list] of byOffering) {
    const at = nextOccurrence(list, now, timezone);
    if (at) out.set(id, at);
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `cd backend && npx vitest run src/modules/juvi-app/spaces/__tests__/next-class.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/spaces/next-class.ts backend/src/modules/juvi-app/spaces/__tests__/next-class.test.ts
git commit -m "feat(juvi-app): next scheduled class from weekly timetable slots in the institution timezone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Spaces service and routes

**Files:**
- Create: `backend/src/modules/juvi-app/spaces/schemas.ts`, `backend/src/modules/juvi-app/spaces/spaces-service.ts`, `backend/src/modules/juvi-app/spaces/controller.ts`, `backend/src/modules/juvi-app/spaces/routes.ts`
- Modify: `backend/src/modules/juvi-app/routes.ts` (register `spacesRouter`)
- Test: `backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts`

**Interfaces:**
- Consumes: `reconcileAccount` (Task 15), `nextClassByOffering`, `formatNextClassLabel` (Task 16), `getJuviConfig` (Task 5), `MobileContext` (Task 8).
- Produces:
  ```ts
  // schemas.ts
  export const spaceChannelRowSchema, spacesGroupSchema, spacesResponseSchema, channelDetailSchema, muteResponseSchema, readResponseSchema;
  export type SpacesResponse = z.infer<typeof spacesResponseSchema>; export type ChannelDetail = z.infer<typeof channelDetailSchema>;
  // spaces-service.ts
  export const RECONCILE_STALE_MS = 60_000;
  export async function listSpaces(ctx: MobileContext): Promise<SpacesResponse>;
  export async function getChannel(ctx: MobileContext, channelId: string): Promise<ChannelDetail>;
  export async function setMute(ctx: MobileContext, channelId: string, muted: boolean): Promise<{ muted: boolean }>;
  export async function markRead(ctx: MobileContext, channelId: string): Promise<{ lastReadAt: string }>;
  // routes.ts
  export const spacesRouter: Router;
  ```

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { College, Enrollment, Timetable, TimetableSlot } from '../../models';
import { Channel } from '../../models/juvi/Channel';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

async function tokenFor(identifier: string, password: string, deviceId = TEST_DEVICE.id) {
  const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}

async function scenario() {
  const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const fac = await provisionTestFaculty(fx);
  const mk = async (code: string, name: string) => {
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code, name });
    const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await off.updateOne({ $set: { status: 'active' } });
    await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    return off;
  };
  const dbms = await mk('CS201', 'DBMS'); const os = await mk('CS202', 'OS');
  const tt = await Timetable.create({ collegeId: fx.collegeId, semesterId: fx.sem1._id, sectionId: fx.cseSection._id, status: 'published', effectiveFrom: new Date() });
  // OS is always sooner than DBMS: OS every day at 08:00, DBMS every day at 17:00.
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
    await TimetableSlot.create({ collegeId: fx.collegeId, timetableId: tt._id, day, period: 1, startTime: '08:00', endTime: '09:00', courseOfferingId: os._id });
    await TimetableSlot.create({ collegeId: fx.collegeId, timetableId: tt._id, day, period: 8, startTime: '17:00', endTime: '18:00', courseOfferingId: dbms._id });
  }
  await reconcileCollege(fx.collegeId);
  return { stu, fac, dbms, os };
}

describe('GET /spaces', () => {
  it('groups in student order, orders courses by next class, and includes an emptyHint only for courses', async () => {
    const { stu, os } = await scenario();
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    expect(res.body.groups.map((g: any) => g.key)).toEqual(['college', 'department', 'batch', 'courses']);
    const courses = res.body.groups[3];
    expect(courses.title).toBe('My Courses');
    expect(courses.channels.map((c: any) => c.name)).toEqual(['CS202 OS · A', 'CS201 DBMS · A']);
    expect(courses.channels[0].nextClassLabel).toMatch(/^Next: (Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat) 08:00$/);
    expect(courses.channels[0].id).toBe(String((await Channel.findOne({ scopeId: os._id }).lean())!._id));
    expect(res.body.groups[0].channels[0]).toMatchObject({ name: 'JIT Test College', muted: false, archived: false, role: 'member' });
    expect(res.body.asOf).toBeTypeOf('string');
  });

  it('faculty order starts with My Courses and roles are publisher', async () => {
    const { fac } = await scenario();
    const t = await tokenFor(fac.faculty.employeeCode, fac.tempPassword, 'device-f');
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    expect(res.body.groups.map((g: any) => g.key)).toEqual(['courses', 'department', 'college']);
    expect(res.body.groups[0].channels.every((c: any) => c.role === 'publisher')).toBe(true);
  });

  it('a student with no registrations sees the courses group with a hint', async () => {
    await scenario();
    const other = await provisionTestStudent(fx);
    const t = await tokenFor(other.student.rollNumber, other.tempPassword, 'device-o');
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    const courses = res.body.groups.find((g: any) => g.key === 'courses');
    expect(courses.channels).toEqual([]);
    expect(courses.emptyHint).toMatch(/registrations/i);
  });

  it('reflects an ERP drop on the next refresh without a college pass', async () => {
    const { stu, dbms } = await scenario();
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    await Enrollment.updateOne({ studentId: stu.student._id, courseOfferingId: dbms._id }, { $set: { status: 'dropped' } });
    // Force staleness so the inline account reconcile runs.
    const { JuviAccount } = await import('../../models/juvi/JuviAccount');
    await JuviAccount.updateOne({ _id: stu.account._id }, { $set: { lastReconciledAt: new Date(Date.now() - 120_000) } });
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    expect(res.body.groups.find((g: any) => g.key === 'courses').channels.map((c: any) => c.name)).toEqual(['CS202 OS · A']);
  });

  it('archived channels collapse into an Archived group', async () => {
    const { stu } = await scenario();
    await fx.sem1.updateOne({ $set: { status: 'completed' } });
    await reconcileCollege(fx.collegeId);
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    const res = await mobileClient(app, t).get(`${V1}/spaces`).expect(200);
    const archived = res.body.groups.at(-1);
    expect(archived.key).toBe('archived');
    expect(archived.channels).toHaveLength(2);
    expect(archived.channels[0].archived).toBe(true);
  });
});

describe('channel detail, mute, read', () => {
  it('returns About for a member and 404 for a non-member or another college', async () => {
    const { stu, fac, dbms } = await scenario();
    const ch = (await Channel.findOne({ scopeId: dbms._id }).lean())!;
    const ts = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    const detail = await mobileClient(app, ts).get(`${V1}/channels/${ch._id}`).expect(200);
    expect(detail.body).toMatchObject({ id: String(ch._id), name: 'CS201 DBMS · A', memberCount: 2, canPost: false, canReply: true, replyRule: 'allowed', whoCanPost: 'Course faculty', linkedObject: { type: 'course_offering', id: String(dbms._id) } });
    const tf = await tokenFor(fac.faculty.employeeCode, fac.tempPassword, 'device-f');
    expect((await mobileClient(app, tf).get(`${V1}/channels/${ch._id}`).expect(200)).body.canPost).toBe(true);

    const outsider = await provisionTestStudent(fx);
    const to = await tokenFor(outsider.student.rollNumber, outsider.tempPassword, 'device-o');
    const nf = await mobileClient(app, to).get(`${V1}/channels/${ch._id}`).expect(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    await mobileClient(app, ts).get(`${V1}/channels/000000000000000000000001`).expect(404);
    await mobileClient(app, ts).get(`${V1}/channels/not-an-id`).expect(400);
  });

  it('mute and unmute persist; mark-read stamps lastReadAt', async () => {
    const { stu, dbms } = await scenario();
    const ch = (await Channel.findOne({ scopeId: dbms._id }).lean())!;
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    expect((await mobileClient(app, t).put(`${V1}/channels/${ch._id}/mute`).expect(200)).body).toEqual({ muted: true });
    expect((await mobileClient(app, t).get(`${V1}/spaces`)).body.groups.find((g: any) => g.key === 'courses').channels.find((c: any) => c.id === String(ch._id)).muted).toBe(true);
    expect((await mobileClient(app, t).delete(`${V1}/channels/${ch._id}/mute`).expect(200)).body).toEqual({ muted: false });
    const read = await mobileClient(app, t).post(`${V1}/channels/${ch._id}/read`).expect(200);
    expect(read.body.lastReadAt).toBeTypeOf('string');
    expect((await ChannelMembership.findOne({ channelId: ch._id, accountId: stu.account._id }).lean())?.lastReadAt).toBeInstanceOf(Date);
  });

  it('no create, join, leave or discover routes exist', async () => {
    const { stu } = await scenario();
    const t = await tokenFor(stu.student.rollNumber, stu.tempPassword);
    for (const path of ['/channels', '/channels/discover']) await mobileClient(app, t).post(`${V1}${path}`).send({}).expect(404);
    await mobileClient(app, t).post(`${V1}/channels/000000000000000000000001/join`).expect(404);
    await mobileClient(app, t).delete(`${V1}/channels/000000000000000000000001`).expect(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-spaces.e2e.test.ts`
Expected: FAIL with 404 on `/spaces`.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/spaces/schemas.ts
import { z } from 'zod';

export const spaceChannelRowSchema = z.object({
  id: z.string(), name: z.string(), about: z.string(),
  scopeType: z.enum(['college', 'department', 'batch', 'course_offering', 'hostel_block']),
  templateCode: z.enum(['college', 'department', 'batch', 'course', 'hostel']),
  role: z.enum(['member', 'publisher']), muted: z.boolean(), memberCount: z.number().int(), archived: z.boolean(),
  nextClassAt: z.string().nullable(), nextClassLabel: z.string().nullable(),
});
export const spacesGroupSchema = z.object({
  key: z.enum(['college', 'department', 'batch', 'courses', 'hostel', 'archived']),
  title: z.string(), emptyHint: z.string().optional(), channels: z.array(spaceChannelRowSchema),
});
export const spacesResponseSchema = z.object({ groups: z.array(spacesGroupSchema), asOf: z.string() });
export type SpacesResponse = z.infer<typeof spacesResponseSchema>;
export type SpaceChannelRow = z.infer<typeof spaceChannelRowSchema>;

export const channelDetailSchema = z.object({
  id: z.string(), name: z.string(), about: z.string(),
  scopeType: spaceChannelRowSchema.shape.scopeType, templateCode: spaceChannelRowSchema.shape.templateCode,
  status: z.enum(['active', 'archived']), memberCount: z.number().int(),
  replyRule: z.enum(['allowed', 'announcement_only']), defaultPriority: z.enum(['routine', 'important']),
  role: z.enum(['member', 'publisher']), muted: z.boolean(), canPost: z.boolean(), canReply: z.boolean(),
  whoCanPost: z.string(), linkedObject: z.object({ type: z.string(), id: z.string().nullable() }),
});
export type ChannelDetail = z.infer<typeof channelDetailSchema>;

export const muteResponseSchema = z.object({ muted: z.boolean() });
export const readResponseSchema = z.object({ lastReadAt: z.string() });
```

```ts
// backend/src/modules/juvi-app/spaces/spaces-service.ts
import { Types } from 'mongoose';
import { Channel, IChannel } from '../../../models/juvi/Channel';
import { ChannelMembership, IChannelMembership } from '../../../models/juvi/ChannelMembership';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { TemplateCode } from '../../../models/juvi/ChannelTemplate';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { notFound } from '../errors';
import { reconcileAccount } from './reconcile-service';
import { nextClassByOffering, formatNextClassLabel } from './next-class';
import { SpacesResponse, SpaceChannelRow, ChannelDetail } from './schemas';

export const RECONCILE_STALE_MS = 60_000;

type GroupKey = 'college' | 'department' | 'batch' | 'courses' | 'hostel' | 'archived';
const GROUP_OF: Record<TemplateCode, GroupKey> = { college: 'college', department: 'department', batch: 'batch', course: 'courses', hostel: 'hostel' };
const TITLES: Record<GroupKey, string> = { college: 'College', department: 'My Department', batch: 'My Batch', courses: 'My Courses', hostel: 'Hostel', archived: 'Archived' };
const STUDENT_ORDER: GroupKey[] = ['college', 'department', 'batch', 'courses', 'hostel', 'archived'];
const STAFF_ORDER: GroupKey[] = ['courses', 'department', 'college', 'batch', 'hostel', 'archived'];
const COURSES_EMPTY_HINT = 'Your course spaces appear here once your registrations are in.';
const WHO_CAN_POST: Record<TemplateCode, string> = {
  college: 'College office and staff publishers', department: 'HOD, principal and registrar',
  batch: 'Class coordinators, HOD, admissions and registrar', course: 'Course faculty', hostel: 'Wardens',
};

async function maybeReconcile(ctx: MobileContext): Promise<void> {
  const acct = await JuviAccount.findById(ctx.accountId).select('lastReconciledAt').lean();
  const last = acct?.lastReconciledAt?.getTime() ?? 0;
  if (Date.now() - last > RECONCILE_STALE_MS) {
    try { await reconcileAccount(ctx.collegeId, ctx.accountId); } catch (err) { console.error('[juvi-app] inline reconcile failed', err); }
  }
}

export async function listSpaces(ctx: MobileContext): Promise<SpacesResponse> {
  await maybeReconcile(ctx);
  const memberships = await ChannelMembership.find({ collegeId: ctx.collegeId, accountId: ctx.accountId }).lean();
  const channels = await Channel.find({ _id: { $in: memberships.map((m) => m.channelId) }, collegeId: ctx.collegeId }).lean();
  const membershipByChannel = new Map(memberships.map((m) => [String(m.channelId), m]));
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const courseIds = channels.filter((c) => c.scopeType === 'course_offering' && c.status === 'active' && c.scopeId).map((c) => String(c.scopeId));
  const nextBy = await nextClassByOffering(ctx.collegeId, courseIds, tz);
  const now = new Date();

  const rows = new Map<GroupKey, SpaceChannelRow[]>();
  for (const c of channels) {
    const m = membershipByChannel.get(String(c._id))!;
    const next = c.scopeId ? nextBy.get(String(c.scopeId)) : undefined;
    const row: SpaceChannelRow = {
      id: String(c._id), name: c.name, about: c.about, scopeType: c.scopeType, templateCode: c.templateCode,
      role: m.role, muted: Boolean(m.mutedAt), memberCount: c.memberCount, archived: c.status === 'archived',
      nextClassAt: next ? next.toISOString() : null, nextClassLabel: next ? formatNextClassLabel(next, now, tz) : null,
    };
    const key: GroupKey = c.status === 'archived' ? 'archived' : GROUP_OF[c.templateCode];
    rows.set(key, [...(rows.get(key) ?? []), row]);
  }
  const courses = rows.get('courses') ?? [];
  courses.sort((a, b) => (a.nextClassAt ?? '9').localeCompare(b.nextClassAt ?? '9') || a.name.localeCompare(b.name));
  for (const [k, list] of rows) if (k !== 'courses') list.sort((a, b) => a.name.localeCompare(b.name));

  const order = ctx.kind === 'student' ? STUDENT_ORDER : STAFF_ORDER;
  const groups: SpacesResponse['groups'] = [];
  for (const key of order) {
    const list = rows.get(key) ?? [];
    if (key === 'courses') groups.push({ key, title: TITLES[key], channels: list, ...(list.length === 0 ? { emptyHint: COURSES_EMPTY_HINT } : {}) });
    else if (list.length > 0) groups.push({ key, title: TITLES[key], channels: list });
  }
  return { groups, asOf: now.toISOString() };
}

async function memberChannel(ctx: MobileContext, channelId: string): Promise<{ channel: IChannel; membership: IChannelMembership }> {
  if (!Types.ObjectId.isValid(channelId)) throw notFound('Channel');
  const membership = await ChannelMembership.findOne({ collegeId: ctx.collegeId, channelId, accountId: ctx.accountId });
  const channel = membership ? await Channel.findOne({ _id: channelId, collegeId: ctx.collegeId }) : null;
  // Non-members and other colleges both get 404 (spec §15).
  if (!membership || !channel) throw notFound('Channel');
  return { channel, membership };
}

export async function getChannel(ctx: MobileContext, channelId: string): Promise<ChannelDetail> {
  const { channel: c, membership: m } = await memberChannel(ctx, channelId);
  const active = c.status === 'active';
  return {
    id: String(c._id), name: c.name, about: c.about, scopeType: c.scopeType, templateCode: c.templateCode,
    status: c.status, memberCount: c.memberCount, replyRule: c.replyRule, defaultPriority: c.defaultPriority,
    role: m.role, muted: Boolean(m.mutedAt),
    canPost: active && m.role === 'publisher',
    canReply: active && (c.replyRule === 'allowed' || m.role === 'publisher'),
    whoCanPost: WHO_CAN_POST[c.templateCode],
    linkedObject: { type: c.scopeType, id: c.scopeId ? String(c.scopeId) : null },
  };
}

export async function setMute(ctx: MobileContext, channelId: string, muted: boolean): Promise<{ muted: boolean }> {
  const { membership } = await memberChannel(ctx, channelId);
  membership.mutedAt = muted ? new Date() : null;
  await membership.save();
  return { muted };
}

export async function markRead(ctx: MobileContext, channelId: string): Promise<{ lastReadAt: string }> {
  const { membership } = await memberChannel(ctx, channelId);
  membership.lastReadAt = new Date();
  await membership.save();
  return { lastReadAt: membership.lastReadAt.toISOString() };
}
```

```ts
// backend/src/modules/juvi-app/spaces/controller.ts
import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { objectId } from '../accounts/schemas';
import * as spaces from './spaces-service';

export async function listSpaces(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.listSpaces(requireMobile(req))); } catch (e) { next(e); }
}
export async function getChannel(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.getChannel(requireMobile(req), objectId.parse(req.params.id))); } catch (e) { next(e); }
}
export async function mute(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.setMute(requireMobile(req), objectId.parse(req.params.id), true)); } catch (e) { next(e); }
}
export async function unmute(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.setMute(requireMobile(req), objectId.parse(req.params.id), false)); } catch (e) { next(e); }
}
export async function markRead(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await spaces.markRead(requireMobile(req), objectId.parse(req.params.id))); } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/spaces/routes.ts
import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import * as ctrl from './controller';

export const spacesRouter = Router();
spacesRouter.use(authenticateMobile);
spacesRouter.get('/spaces', ctrl.listSpaces);
spacesRouter.get('/channels/:id', ctrl.getChannel);
spacesRouter.put('/channels/:id/mute', ctrl.mute);
spacesRouter.delete('/channels/:id/mute', ctrl.unmute);
spacesRouter.post('/channels/:id/read', ctrl.markRead);
// Deliberately no POST /channels, join, leave, invite or discover (SPC-07).
```

Modify `backend/src/modules/juvi-app/routes.ts`:

```ts
import { spacesRouter } from './spaces/routes';
v1Router.use(spacesRouter);
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-spaces.e2e.test.ts && npm run typecheck`
Expected: PASS (8 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts
git commit -m "feat(juvi-app): grouped Spaces list with next-class ordering, channel About, mute and read

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Institution lookup and config routes

**Files:**
- Create: `backend/src/modules/juvi-app/config/schemas.ts`, `backend/src/modules/juvi-app/config/controller.ts`, `backend/src/modules/juvi-app/config/routes.ts`
- Modify: `backend/src/modules/juvi-app/routes.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const institutionLookupResponseSchema = z.object({ collegeId, name, logoUrl: nullable, accentColor: nullable, paused: boolean, pausedMessage: nullable, minAppVersion: { android?: string; ios?: string } | null });
  export const configResponseSchema = z.object({ name, code, logoUrl, accentColor, supportContact, quietHoursDefault, timezone, featureFlags, minAppVersion, onboardingSteps: string[] });
  export const configRouter: Router;   // GET /institutions/:code (public), GET /config (auth)
  ```

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { College } from '../../models/College';
import { invalidateJuviConfig } from '../../modules/juvi-app/config/institution-config';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('GET /institutions/:code', () => {
  it('returns identity for an enabled college, case-insensitively', async () => {
    await enableJuvi(fx.collegeId, { accentColor: '#112233', minAppVersion: { android: '1.0.0' } });
    const res = await mobileClient(app).get(`${V1}/institutions/jit-test`).expect(200);
    expect(res.body).toEqual({ collegeId: fx.collegeId, name: 'JIT Test College', logoUrl: null, accentColor: '#112233', paused: false, pausedMessage: null, minAppVersion: { android: '1.0.0' } });
  });

  it('returns the same 404 body for unknown, disabled and inactive codes', async () => {
    const unknown = await mobileClient(app).get(`${V1}/institutions/NOPE`).expect(404);
    const disabled = await mobileClient(app).get(`${V1}/institutions/JIT-TEST`).expect(404);
    await enableJuvi(fx.collegeId); await College.updateOne({ _id: fx.collegeId }, { $set: { status: 'suspended' } }); await invalidateJuviConfig(fx.collegeId);
    const inactive = await mobileClient(app).get(`${V1}/institutions/JIT-TEST`).expect(404);
    expect(unknown.body).toEqual(disabled.body);
    expect(unknown.body).toEqual(inactive.body);
    expect(unknown.body.error.message).toBe("We couldn't find that college code.");
  });
});

describe('GET /config', () => {
  it('returns branding, defaults and onboarding steps to a signed-in user', async () => {
    await enableJuvi(fx.collegeId, { supportContact: { name: 'Office', phone: '1' } });
    const s = await provisionTestStudent(fx);
    const t = (await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier: s.student.rollNumber, password: s.tempPassword, device: TEST_DEVICE })).body.accessToken;
    const res = await mobileClient(app, t).get(`${V1}/config`).expect(200);
    expect(res.body).toMatchObject({ name: 'JIT Test College', code: 'JIT-TEST', supportContact: { name: 'Office', phone: '1' }, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false }, onboardingSteps: ['identity', 'spaces', 'notifications'] });
  });

  it('is 503 INSTITUTION_PAUSED once the admin pauses', async () => {
    await enableJuvi(fx.collegeId);
    const s = await provisionTestStudent(fx);
    const t = (await mobileClient(app).post(`${V1}/auth/sign-in`).send({ collegeId: fx.collegeId, identifier: s.student.rollNumber, password: s.tempPassword, device: TEST_DEVICE })).body.accessToken;
    await enableJuvi(fx.collegeId, { paused: true, pausedMessage: 'Back Monday' });
    const res = await mobileClient(app, t).get(`${V1}/config`).expect(503);
    expect(res.body.error).toEqual({ code: 'INSTITUTION_PAUSED', message: 'Back Monday' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-config.e2e.test.ts`
Expected: FAIL with 404 "Route not found" on `/institutions/jit-test`.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/config/schemas.ts
import { z } from 'zod';

const minAppVersion = z.object({ android: z.string().optional(), ios: z.string().optional() }).nullable();
const supportContact = z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional() }).nullable();

export const institutionLookupResponseSchema = z.object({
  collegeId: z.string(), name: z.string(), logoUrl: z.string().nullable(), accentColor: z.string().nullable(),
  paused: z.boolean(), pausedMessage: z.string().nullable(), minAppVersion,
});

export const configResponseSchema = z.object({
  name: z.string(), code: z.string(), logoUrl: z.string().nullable(), accentColor: z.string().nullable(),
  supportContact, quietHoursDefault: z.object({ start: z.string(), end: z.string() }), timezone: z.string(),
  featureFlags: z.object({ languageRoadmap: z.boolean() }), minAppVersion, onboardingSteps: z.array(z.string()),
});
```

```ts
// backend/src/modules/juvi-app/config/controller.ts
import { Request, Response, NextFunction } from 'express';
import { isS3Configured, getPresignedUrl } from '../../../shared/s3/s3-client';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { ONBOARDING_STEPS } from '../accounts/onboarding';
import { lookupInstitutionByCode, getJuviConfig } from './institution-config';

async function logoUrl(key?: string): Promise<string | null> {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  if (!isS3Configured()) return null;
  try { return (await getPresignedUrl(key, { expiresIn: 86_400 })).url; } catch { return null; }
}

export async function lookupInstitution(req: Request, res: Response, next: NextFunction) {
  try {
    const cfg = await lookupInstitutionByCode(String(req.params.code ?? ''));
    if (!cfg) throw new MobileApiError(404, 'NOT_FOUND', "We couldn't find that college code.");
    res.json({
      collegeId: cfg.collegeId, name: cfg.name, logoUrl: await logoUrl(cfg.logo), accentColor: cfg.accentColor ?? null,
      paused: cfg.paused, pausedMessage: cfg.pausedMessage ?? null, minAppVersion: cfg.minAppVersion ?? null,
    });
  } catch (e) { next(e); }
}

export async function getConfig(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const cfg = await getJuviConfig(ctx.collegeId);
    if (!cfg) throw new MobileApiError(404, 'NOT_FOUND', 'Institution not found');
    res.json({
      name: cfg.name, code: cfg.code, logoUrl: await logoUrl(cfg.logo), accentColor: cfg.accentColor ?? null,
      supportContact: cfg.supportContact ?? null, quietHoursDefault: cfg.quietHoursDefault, timezone: cfg.timezone,
      featureFlags: cfg.featureFlags, minAppVersion: cfg.minAppVersion ?? null, onboardingSteps: [...ONBOARDING_STEPS],
    });
  } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/config/routes.ts
import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { institutionLookupLimiter } from '../middleware/rate-limits';
import * as ctrl from './controller';

export const configRouter = Router();
configRouter.get('/institutions/:code', institutionLookupLimiter, ctrl.lookupInstitution);
configRouter.get('/config', authenticateMobile, ctrl.getConfig);
```

Modify `backend/src/modules/juvi-app/routes.ts` so the final assembly reads:

```ts
import { Router } from 'express';
import { mobileErrorHandler, MobileApiError } from './errors';
import { configRouter } from './config/routes';
import { accountsRouter } from './accounts/routes';
import { spacesRouter } from './spaces/routes';

export const v1Router = Router();
v1Router.use(configRouter);
v1Router.use(accountsRouter);
v1Router.use(spacesRouter);

const router = Router();
router.use('/v1', v1Router);
router.use((_req, _res, next) => next(new MobileApiError(404, 'NOT_FOUND', 'Route not found')));
router.use(mobileErrorHandler);
export default router;
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-config.e2e.test.ts && npm run typecheck`
Expected: PASS (4 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts
git commit -m "feat(juvi-app): public institution lookup and authenticated config endpoint

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 19: Provisioning and reconcile workers

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/provisioning-worker.ts`, `backend/src/modules/juvi-app/spaces/reconcile-worker.ts`
- Modify: `backend/src/shared/queue/QueueManager.ts:113-135` (QUEUE_NAMES), `backend/src/server.ts:13-26`
- Test: `backend/src/__e2e__/modules/juvi-app-provisioning-worker.e2e.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // provisioning-worker.ts
  export async function runProvisioningJob(runId: string): Promise<IJuviProvisioningRun>;     // the processor body; testable without BullMQ
  export async function createProvisioningRun(input: { collegeId: string; filter: IProvisioningFilter; options?: { resetExistingPasswords?: boolean }; performedBy: string }): Promise<IJuviProvisioningRun>;
  export function registerJuviProvisioningQueue(): void;
  // reconcile-worker.ts
  export async function reconcileAllEnabledColleges(): Promise<{ colleges: number }>;
  export async function registerJuviReconcileQueue(intervalMinutes?: number): Promise<void>;
  export async function enqueueReconcile(collegeId: string): Promise<void>;                     // manual trigger; falls back to inline when no queue
  // QueueManager
  QUEUE_NAMES.JUVI_PROVISIONING = 'juvi_provisioning'; QUEUE_NAMES.JUVI_RECONCILE = 'juvi_reconcile';
  ```

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-provisioning-worker.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestStudent } from '../factories/student.factory';
import { createTestFaculty } from '../factories/academic.factory';
import { Person, Student, Batch } from '../../models';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { JuviProvisioningRun } from '../../models/juvi/JuviProvisioningRun';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { runProvisioningJob } from '../../modules/juvi-app/accounts/provisioning-worker';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function studentWithoutUser(roll: string, batchId: unknown, status = 'active') {
  const person = await Person.create({ collegeId: fx.collegeId, name: `S ${roll}`, phone: `9${roll.padStart(9, '0')}` });
  return Student.create({ collegeId: fx.collegeId, personId: person._id, admissionYear: 2024, rollNumber: roll, status, batchId, branchId: fx.cseBranch._id, programmeId: fx.btech._id });
}

describe('runProvisioningJob', () => {
  it('provisions active students in the filter, counts created vs linked, expires credentials in 7 days', async () => {
    const otherBatch = await Batch.create({ collegeId: fx.collegeId, code: '2023', name: '2023 Batch', admissionYear: 2023, programmeId: fx.btech._id, regulationId: fx.regulation._id });
    await studentWithoutUser('24A001', fx.batch._id);
    await studentWithoutUser('24A002', fx.batch._id);
    await studentWithoutUser('24A003', fx.batch._id, 'exited');          // not active → not scanned
    await studentWithoutUser('23A001', otherBatch._id);                  // wrong batch → not scanned
    await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id) }); // has a User → existingLinked
    await createTestFaculty(fx.collegeId);                               // kind not requested

    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'], batchIds: [fx.batch._id] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    const done = await runProvisioningJob(String(run._id));
    expect(done.status).toBe('completed');
    expect(done.counts).toEqual({ scanned: 3, created: 2, existingLinked: 1, skipped: 0, failed: 0 });
    expect(done.startedAt).toBeInstanceOf(Date); expect(done.finishedAt).toBeInstanceOf(Date);
    expect(done.credentialsExpireAt!.getTime() - done.startedAt!.getTime()).toBeCloseTo(7 * 86_400_000, -4);
    expect(await JuviAccount.countDocuments({ collegeId: fx.collegeId })).toBe(3);
    expect(await JuviProvisionedCredential.countDocuments({ runId: run._id })).toBe(3);
  });

  it('re-running skips existing accounts and records per-person failures as partial', async () => {
    await studentWithoutUser('24B001', fx.batch._id);
    const broken = await studentWithoutUser('24B002', fx.batch._id);
    await Person.deleteOne({ _id: broken.personId });                    // orphaned student → provisionPerson throws
    const run1 = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    const r1 = await runProvisioningJob(String(run1._id));
    expect(r1.status).toBe('partial');
    expect(r1.counts).toMatchObject({ scanned: 2, created: 1, failed: 1 });
    expect(r1.errors[0]).toMatchObject({ personId: broken.personId, reason: expect.stringMatching(/Person not found/) });

    const run2 = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    const r2 = await runProvisioningJob(String(run2._id));
    expect(r2.counts).toMatchObject({ scanned: 2, created: 0, skipped: 1, failed: 1 });
  });

  it('provisions faculty by department', async () => {
    const f = await createTestFaculty(fx.collegeId, { departmentId: String(fx.cse._id) });
    await createTestFaculty(fx.collegeId, { departmentId: String(fx.ece._id) });
    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['faculty'], departmentIds: [fx.cse._id] }, options: { resetExistingPasswords: false }, performedBy: 'admin' });
    const done = await runProvisioningJob(String(run._id));
    expect(done.counts).toMatchObject({ scanned: 1, existingLinked: 1 });
    expect(await JuviAccount.countDocuments({ facultyId: f.faculty._id })).toBe(1);
    expect(await JuviProvisionedCredential.countDocuments({ runId: run._id })).toBe(0);   // no reset → no credential
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-provisioning-worker.e2e.test.ts`
Expected: FAIL with "Cannot find module '../../modules/juvi-app/accounts/provisioning-worker'".

- [ ] **Step 3: Implement**

Add to `QUEUE_NAMES` in `backend/src/shared/queue/QueueManager.ts` (after the Finance block):

```ts
  // Juvi mobile app
  JUVI_PROVISIONING: 'juvi_provisioning',
  JUVI_RECONCILE: 'juvi_reconcile',
```

```ts
// backend/src/modules/juvi-app/accounts/provisioning-worker.ts
import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Branch } from '../../../models/academic-structure/Branch';
import { JuviProvisioningRun, IJuviProvisioningRun, IProvisioningFilter } from '../../../models/juvi/JuviProvisioningRun';
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { registerQueue, addJob, QUEUE_NAMES } from '../../../shared/queue';
import { provisionPerson } from './provisioning-service';
import { CREDENTIAL_TTL_DAYS } from './credential-store';

const BATCH_SIZE = 100;
const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_RECORDED_ERRORS = 500;

/** Person ids to provision for one kind, honouring the run filter. Active rows only. */
async function candidatePersonIds(collegeId: string, kind: AccountKind, filter: IProvisioningFilter): Promise<Types.ObjectId[]> {
  if (kind === 'student') {
    const q: Record<string, unknown> = { collegeId, status: 'active' };
    if (filter.programmeIds?.length) q.programmeId = { $in: filter.programmeIds };
    if (filter.batchIds?.length) q.batchId = { $in: filter.batchIds };
    if (filter.departmentIds?.length) {
      const branches = await Branch.find({ collegeId, departmentId: { $in: filter.departmentIds } }).select('_id').lean();
      q.branchId = { $in: branches.map((b) => b._id) };
    }
    return (await Student.find(q).select('personId').lean()).map((s) => s.personId as Types.ObjectId);
  }
  const q: Record<string, unknown> = { collegeId, status: 'active' };
  if (filter.departmentIds?.length) q.departmentId = { $in: filter.departmentIds };
  const rows = kind === 'faculty' ? await Faculty.find(q).select('personId').lean() : await Staff.find(q).select('personId').lean();
  return rows.map((r) => r.personId as Types.ObjectId);
}

export async function runProvisioningJob(runId: string): Promise<IJuviProvisioningRun> {
  const run = await JuviProvisioningRun.findById(runId);
  if (!run) throw new Error(`Provisioning run ${runId} not found`);
  const startedAt = new Date();
  run.status = 'running'; run.startedAt = startedAt;
  run.counts = { scanned: 0, created: 0, existingLinked: 0, skipped: 0, failed: 0 }; run.errors = [];
  run.credentialsExpireAt = new Date(startedAt.getTime() + CREDENTIAL_TTL_DAYS * 86_400_000);
  await run.save();

  const collegeId = String(run.collegeId);
  let consecutiveFailures = 0;
  let aborted = false;

  for (const kind of run.filter.kinds) {
    const personIds = await candidatePersonIds(collegeId, kind, run.filter);
    for (let i = 0; i < personIds.length && !aborted; i += BATCH_SIZE) {
      for (const personId of personIds.slice(i, i + BATCH_SIZE)) {
        run.counts.scanned += 1;
        try {
          const r = await provisionPerson({ collegeId, personId: String(personId), kind, source: 'bulk', performedBy: run.performedBy, resetPassword: run.options.resetExistingPasswords, runId });
          if (!r.created) run.counts.skipped += 1;
          else if (r.userCreated) run.counts.created += 1;
          else run.counts.existingLinked += 1;
          consecutiveFailures = 0;
        } catch (err) {
          run.counts.failed += 1;
          consecutiveFailures += 1;
          if (run.errors.length < MAX_RECORDED_ERRORS) run.errors.push({ personId, reason: err instanceof Error ? err.message : String(err) });
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { aborted = true; break; }
        }
      }
      await run.save();   // progress is visible to the console every batch
    }
    if (aborted) break;
  }

  run.status = aborted ? 'failed' : run.counts.failed > 0 ? 'partial' : 'completed';
  run.finishedAt = new Date();
  await run.save();
  console.log(`[juvi-app] provisioning run ${runId}: ${run.status}`, run.counts);
  return run;
}

export async function createProvisioningRun(input: {
  collegeId: string; filter: IProvisioningFilter; options?: { resetExistingPasswords?: boolean }; performedBy: string;
}): Promise<IJuviProvisioningRun> {
  const run = await JuviProvisioningRun.create({
    collegeId: input.collegeId, filter: input.filter,
    options: { resetExistingPasswords: input.options?.resetExistingPasswords ?? true }, performedBy: input.performedBy,
  });
  try {
    await addJob(QUEUE_NAMES.JUVI_PROVISIONING, 'run', { runId: String(run._id) }, { attempts: 1 });
  } catch (err) {
    // No worker registered (dev without Redis): run inline so the console still works.
    console.warn('[juvi-app] provisioning queue unavailable, running inline:', err instanceof Error ? err.message : err);
    void runProvisioningJob(String(run._id)).catch((e) => console.error('[juvi-app] inline provisioning failed', e));
  }
  return run;
}

export function registerJuviProvisioningQueue(): void {
  registerQueue({
    name: QUEUE_NAMES.JUVI_PROVISIONING,
    processor: async (job: Job) => runProvisioningJob(String(job.data.runId)),
    concurrency: 1,
  });
}
```

```ts
// backend/src/modules/juvi-app/spaces/reconcile-worker.ts
import { Job } from 'bullmq';
import { College } from '../../../models/College';
import { registerQueue, getQueue, addJob, QUEUE_NAMES } from '../../../shared/queue';
import { reconcileCollege } from './reconcile-service';

export async function reconcileAllEnabledColleges(): Promise<{ colleges: number }> {
  const colleges = await College.find({ 'juvi.enabled': true, status: 'active' }).select('_id').lean();
  for (const c of colleges) {
    try { await reconcileCollege(String(c._id)); } catch (err) { console.error('[juvi-app] reconcile failed for college', String(c._id), err); }
  }
  return { colleges: colleges.length };
}

async function processor(job: Job): Promise<unknown> {
  if (job.name === 'reconcile-college') return reconcileCollege(String(job.data.collegeId));
  return reconcileAllEnabledColleges();
}

/** Registers the queue and a repeatable sweep every `intervalMinutes` (env JUVI_RECONCILE_INTERVAL_MINUTES, default 5). */
export async function registerJuviReconcileQueue(intervalMinutes = Number.parseInt(process.env.JUVI_RECONCILE_INTERVAL_MINUTES ?? '5', 10) || 5): Promise<void> {
  registerQueue({ name: QUEUE_NAMES.JUVI_RECONCILE, processor, concurrency: 1 });
  await getQueue(QUEUE_NAMES.JUVI_RECONCILE).add('sweep', {}, {
    repeat: { every: intervalMinutes * 60_000 }, removeOnComplete: true, removeOnFail: true,
  });
}

/** Manual trigger from the admin console; runs inline when the queue is unavailable. */
export async function enqueueReconcile(collegeId: string): Promise<void> {
  try {
    await addJob(QUEUE_NAMES.JUVI_RECONCILE, 'reconcile-college', { collegeId }, { attempts: 1 });
  } catch {
    void reconcileCollege(collegeId).catch((e) => console.error('[juvi-app] inline reconcile failed', e));
  }
}
```

Modify `backend/src/server.ts` — add imports and, inside the `DISABLE_BACKGROUND_JOBS` block after the lead-scoring registration:

```ts
import { registerJuviProvisioningQueue } from './modules/juvi-app/accounts/provisioning-worker';
import { registerJuviReconcileQueue } from './modules/juvi-app/spaces/reconcile-worker';
// ...
    try {
      registerJuviProvisioningQueue();
    } catch (err) {
      console.warn('[server] Failed to register juvi provisioning queue (Redis unavailable?):', err);
    }
    try {
      await registerJuviReconcileQueue();
    } catch (err) {
      console.warn('[server] Failed to register juvi reconcile queue (Redis unavailable?):', err);
    }
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-provisioning-worker.e2e.test.ts && npm run typecheck`
Expected: PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app backend/src/shared/queue/QueueManager.ts backend/src/server.ts backend/src/__e2e__/modules/juvi-app-provisioning-worker.e2e.test.ts
git commit -m "feat(juvi-app): bulk provisioning worker and five-minute reconcile sweep, registered at startup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 20: Student self-scope fix

**Files:**
- Modify: `backend/src/shared/rbac/types.ts:22-30`, `backend/src/shared/rbac/scope-resolver.ts`, `backend/src/shared/rbac/apply-scope.ts:38-55`, `backend/src/middleware/authorize.ts` (the block that builds `req.authScope` from `userScope`)
- Test: `backend/src/shared/rbac/__tests__/student-self-scope.test.ts`

**Interfaces:**
- Produces: `AuthScope.studentId?: string`; `resolveUserScope` returns `studentId` for `role === 'student'`; `applyAuthScope` uses it when `opts.selfField === 'studentId'`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/shared/rbac/__tests__/student-self-scope.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const redisMock = vi.hoisted(() => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK'), del: vi.fn() }));
const models = vi.hoisted(() => ({ User: { findById: vi.fn() }, Faculty: { findOne: vi.fn() }, Staff: { findOne: vi.fn() }, Student: { findOne: vi.fn() } }));
vi.mock('../../../config/redis', () => ({ default: redisMock }));
vi.mock('../../../models/User', () => ({ User: models.User }));
vi.mock('../../../models/people/Faculty', () => ({ Faculty: models.Faculty }));
vi.mock('../../../models/people/Staff', () => ({ Staff: models.Staff }));
vi.mock('../../../models/people/Student', () => ({ Student: models.Student }));
import { resolveUserScope } from '../scope-resolver';
import { applyAuthScope } from '../apply-scope';

const lean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }), lean: () => Promise.resolve(v) });
beforeEach(() => { vi.clearAllMocks(); redisMock.get.mockResolvedValue(null); });

describe('student self scope', () => {
  it('resolveUserScope returns studentId for a student', async () => {
    models.User.findById.mockReturnValue(lean({ personId: 'p1' }));
    models.Student.findOne.mockReturnValue(lean({ _id: 'st1' }));
    expect(await resolveUserScope('u1', 'c1', 'student')).toEqual({ personId: 'p1', studentId: 'st1' });
    expect(models.Student.findOne).toHaveBeenCalledWith({ personId: 'p1', collegeId: 'c1' });
  });

  it('applyAuthScope filters studentId fields by the student id, not the person id', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { departmentOnly: false, selfOnly: true, userId: 'u1', personId: 'p1', studentId: 'st1', resolvedPermissions: [] }, { selfField: 'studentId' });
    expect(filter.studentId).toBe('st1');
  });

  it('applyAuthScope with selfField studentId but no studentId matches nothing', () => {
    const filter: Record<string, unknown> = {};
    applyAuthScope(filter, { departmentOnly: false, selfOnly: true, userId: 'u1', personId: 'p1', resolvedPermissions: [] }, { selfField: 'studentId' });
    expect(filter.studentId).toBe('000000000000000000000000');
  });

  it('other selfFields keep the personId behaviour', () => {
    const filter: Record<string, unknown> = {};
    applyAuthScope(filter, { departmentOnly: false, selfOnly: true, userId: 'u1', personId: 'p1', studentId: 'st1', resolvedPermissions: [] }, { selfField: 'personId' });
    expect(filter.personId).toBe('p1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/shared/rbac/__tests__/student-self-scope.test.ts`
Expected: FAIL: first test gets `{ personId: 'p1' }` without `studentId`; second gets `'p1'`.

- [ ] **Step 3: Implement**

`backend/src/shared/rbac/types.ts` — add to `AuthScope`:

```ts
  /** Resolved for role 'student'; used by applyAuthScope when selfField is 'studentId'. */
  studentId?: string;
```

`backend/src/shared/rbac/scope-resolver.ts` — add the import and the branch:

```ts
import { Student } from '../../models/people/Student';
// in UserScopeData:
  studentId?: string;
// inside `if (personId) { ... }` after the staff branch:
      } else if (role === 'student') {
        const student = await Student.findOne({ personId, collegeId }).select('_id').lean();
        if (student) scope.studentId = String(student._id);
      }
```

`backend/src/shared/rbac/apply-scope.ts` — replace the self-scoping block:

```ts
  // Self scoping: student/parent sees only their own records
  if (authScope.selfOnly) {
    const field = opts?.selfField ?? 'createdBy';
    if (opts?.selfField === 'studentId') {
      // Student._id-keyed records. A missing studentId must match nothing, never everything.
      filter[field] = authScope.studentId ?? '000000000000000000000000';
    } else if (authScope.personId && opts?.selfField) {
      filter[field] = authScope.personId;
    } else {
      filter[field] = authScope.userId;
    }
  }
```

`backend/src/middleware/authorize.ts` — where `req.authScope = { ... personId: userScope.personId, ... }` is built, add `studentId: userScope.studentId,` beside `personId`.

- [ ] **Step 4: Run the test, the existing rbac suite and typecheck**

Run: `cd backend && npx vitest run src/shared/rbac src/middleware && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/rbac backend/src/middleware/authorize.ts
git commit -m "fix(rbac): resolve studentId for student users so self-scoped reads return their own rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 21: ERP hooks (W01 and faculty creation)

**Files:**
- Modify: `backend/src/modules/admissions/workflow.handlers.ts:1479-1559`, `backend/src/modules/people/service.ts:687-711`
- Test: `backend/src/__e2e__/modules/juvi-app-hooks.e2e.test.ts`

**Interfaces:**
- Consumes: `provisionIfEnabled` (Task 9).

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-hooks.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi } from '../factories/juvi.factory';
import { createFaculty } from '../../modules/people/service';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { User } from '../../models/User';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

const facultyPayload = (n: number) => ({ name: `Hook Faculty ${n}`, phone: `93000000${n}${n}`, email: `hook${n}@test.com`, employeeCode: `HK${n}`, designation: 'Assistant Professor', departmentId: String(fx.cse._id) });

describe('createFaculty hook', () => {
  it('provisions a Juvi account with a stored credential when Juvi is enabled', async () => {
    await enableJuvi(fx.collegeId);
    const f = await createFaculty(fx.collegeId, facultyPayload(1), 'hr');
    const account = await JuviAccount.findOne({ collegeId: fx.collegeId, personId: f.personId }).lean();
    expect(account).toMatchObject({ kind: 'faculty', status: 'onboarding' });
    expect(account?.transitions[0]).toMatchObject({ source: 'workflow', by: 'hr' });
    expect((await User.findById(account!.userId).lean())?.mustChangePassword).toBe(true);
    expect(await JuviProvisionedCredential.countDocuments({ accountId: account!._id, source: 'workflow' })).toBe(1);
  });

  it('does nothing when Juvi is disabled', async () => {
    const f = await createFaculty(fx.collegeId, facultyPayload(2), 'hr');
    expect(await JuviAccount.countDocuments({ personId: f.personId })).toBe(0);
    expect(await User.countDocuments({ personId: f.personId })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-hooks.e2e.test.ts`
Expected: FAIL: the first test finds no JuviAccount.

- [ ] **Step 3: Implement the hooks**

`backend/src/modules/people/service.ts` — add the import at the top and change `createFaculty` so the audit line is followed by the hook:

```ts
import { provisionIfEnabled } from '../juvi-app/accounts/provisioning-service';
// ...
  const doc = await Faculty.create(fields);
  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  // Juvi (PRV-01): a hired faculty member gets an app account when the college has Juvi on.
  // Never let Juvi provisioning fail faculty creation.
  await provisionIfEnabled({ collegeId, personId: String(person._id), kind: 'faculty', source: 'workflow', performedBy })
    .catch((err) => console.warn('[juvi-app] faculty provisioning skipped:', err instanceof Error ? err.message : err));
  return { ...doc.toObject(), person: person.toObject() };
```

`backend/src/modules/admissions/workflow.handlers.ts` — add the import with the others, and in the `provision_m12` handler replace the block from `await saveInstanceMetadata(instance, {` to `return { result: provisioningResult };` with:

```ts
  await saveInstanceMetadata(instance, {
    userId: String(user._id),
  });

  // Juvi (PRV-01): when the college has Juvi on, the app's temporary password replaces the
  // hardcoded default above and is retrievable from the Juvi console instead of this result.
  const juvi = await provisionIfEnabled({
    collegeId: String(instance.collegeId),
    personId,
    kind: 'student',
    source: 'workflow',
    performedBy: completedBy,
    resetPassword: true,
  }).catch((err) => {
    console.warn('[juvi-app] W01 provisioning skipped:', err instanceof Error ? err.message : err);
    return null;
  });

  const provisioningResult = {
    ...result,
    studentId: String(student._id),
    userId: String(user._id),
    email: user.email,
    initialPassword: juvi ? undefined : provisionedPassword,
    juviAccountId: juvi ? String(juvi.account._id) : undefined,
    juviCredentialId: juvi?.credentialId,
    accountStatus: 'completed',
  };

  await updateProvisioningStatus(instance, {
    m12_account: 'completed',
  }, provisioningResult);

  return { result: provisioningResult };
```

with `import { provisionIfEnabled } from '../juvi-app/accounts/provisioning-service';` added to the imports at the top of the file. `initialPassword` is consumed nowhere else in the backend or the portal (verified 2026-09-23), so omitting it is safe.

- [ ] **Step 4: Run the hook test, the existing W01 workflow tests, and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-hooks.e2e.test.ts src/__e2e__/workflows && npm run typecheck`
Expected: PASS. The W01 tests still pass because Juvi is disabled in their fixtures, so the handler's result is unchanged there.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/people/service.ts backend/src/modules/admissions/workflow.handlers.ts backend/src/__e2e__/modules/juvi-app-hooks.e2e.test.ts
git commit -m "feat(juvi-app): provision accounts from W01 enrolment and faculty creation when Juvi is enabled

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 22: OpenAPI contract and CI drift check

**Files:**
- Create: `backend/src/modules/juvi-app/openapi/document.ts`, `backend/src/modules/juvi-app/openapi/generate.ts`, `mobile/api/openapi.json`, `.github/workflows/contract.yml`
- Modify: `backend/package.json` (dependency + script)
- Test: `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`

**Interfaces:**
- Produces: `export function buildOpenApiDocument(): Record<string, unknown>` (OpenAPI 3.1, servers `/api/juvi-app/v1`, `bearerAuth` scheme, one path item per route in Tasks 10, 11, 17, 18); `export function stableStringify(value: unknown): string`; npm script `openapi:mobile`.

- [ ] **Step 1: Install the dependency**

Run: `cd backend && npm install @asteasolutions/zod-to-openapi@^7`

- [ ] **Step 2: Write the failing test**

```ts
// backend/src/modules/juvi-app/openapi/__tests__/document.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, stableStringify } from '../document';

const EXPECTED_PATHS = [
  '/institutions/{code}', '/config',
  '/auth/sign-in', '/auth/refresh', '/auth/sign-out', '/auth/change-password',
  '/me', '/me/settings', '/me/onboarding/advance', '/me/devices', '/me/devices/{id}', '/me/devices/revoke-others', '/me/photo',
  '/spaces', '/channels/{id}', '/channels/{id}/mute', '/channels/{id}/read',
];

describe('mobile OpenAPI document', () => {
  const doc = buildOpenApiDocument() as any;

  it('is OpenAPI 3.1 served under the v1 prefix with bearer auth', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers).toEqual([{ url: '/api/juvi-app/v1' }]);
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('declares every v1 route and nothing else', () => {
    expect(Object.keys(doc.paths).sort()).toEqual([...EXPECTED_PATHS].sort());
    expect(doc.paths['/auth/sign-in'].post.security).toBeUndefined();
    expect(doc.paths['/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.paths['/auth/sign-in'].post.responses['401']).toBeDefined();
    expect(doc.components.schemas.ErrorEnvelope).toBeDefined();
  });

  it('names every component and operation so the Dart client is predictable', () => {
    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'ChangePasswordRequest', 'ChannelDetail', 'Config', 'Devices', 'ErrorEnvelope', 'InstitutionLookup', 'Me', 'MuteResult',
      'OnboardingAdvance', 'OnboardingState', 'PhotoResult', 'ReadResult', 'RefreshRequest', 'RevokedCount', 'SettingsPatch',
      'Settings', 'SignInRequest', 'SignInResponse', 'Spaces', 'Tokens',
    ].sort());
    expect(doc.paths['/auth/sign-in'].post.operationId).toBe('signIn');
    expect(doc.paths['/channels/{id}/mute'].delete.operationId).toBe('unmuteChannel');
    expect(doc.paths['/me'].get.tags).toEqual(['mobile']);
  });

  it('stableStringify orders keys so the file is deterministic', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe('{\n  "a": {\n    "c": [\n      3,\n      {\n        "e": 2,\n        "f": 1\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}');
  });

  it('matches the committed mobile/api/openapi.json (run npm run openapi:mobile -w backend if this fails)', () => {
    const file = resolve(__dirname, '../../../../../../mobile/api/openapi.json');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(stableStringify(doc) + '\n');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/openapi/__tests__/document.test.ts`
Expected: FAIL with "Cannot find module '../document'".

- [ ] **Step 4: Implement the document builder and generator**

```ts
// backend/src/modules/juvi-app/openapi/document.ts
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  signInSchema, refreshSchema, changePasswordSchema, signInResponseSchema, tokensResponseSchema,
  meResponseSchema, settingsSchema, settingsPatchSchema, onboardingAdvanceSchema, onboardingStateSchema, devicesResponseSchema,
} from '../accounts/schemas';
import { spacesResponseSchema, channelDetailSchema, muteResponseSchema, readResponseSchema } from '../spaces/schemas';
import { institutionLookupResponseSchema, configResponseSchema } from '../config/schemas';

extendZodWithOpenApi(z);

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(['VALIDATION_FAILED', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED', 'SESSION_INVALIDATED', 'ACCOUNT_DEACTIVATED', 'FORBIDDEN', 'NOT_FOUND', 'GONE', 'UPDATE_REQUIRED', 'COOLDOWN', 'INSTITUTION_PAUSED', 'INTERNAL']),
    message: z.string(),
  }).passthrough(),
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface RouteDef {
  /** Becomes the Dart method name on the generated `MobileApi` class. */
  operationId: string;
  method: Method; path: string; summary: string; auth: boolean;
  body?: z.ZodTypeAny; response?: z.ZodTypeAny; status?: number; params?: string[]; errors: number[]; multipart?: boolean;
}

const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

export function buildOpenApiDocument(): Record<string, unknown> {
  const registry = new OpenAPIRegistry();
  const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });

  // Every schema is a named component so the generated Dart models have stable class names
  // (SignInRequest, Me, Spaces, ChannelDetail, …) instead of derived inline names.
  const C = {
    ErrorEnvelope: registry.register('ErrorEnvelope', errorEnvelopeSchema),
    InstitutionLookup: registry.register('InstitutionLookup', institutionLookupResponseSchema),
    Config: registry.register('Config', configResponseSchema),
    SignInRequest: registry.register('SignInRequest', signInSchema),
    SignInResponse: registry.register('SignInResponse', signInResponseSchema),
    RefreshRequest: registry.register('RefreshRequest', refreshSchema),
    Tokens: registry.register('Tokens', tokensResponseSchema),
    ChangePasswordRequest: registry.register('ChangePasswordRequest', changePasswordSchema),
    Me: registry.register('Me', meResponseSchema),
    Settings: registry.register('Settings', settingsSchema),
    SettingsPatch: registry.register('SettingsPatch', settingsPatchSchema),
    OnboardingAdvance: registry.register('OnboardingAdvance', onboardingAdvanceSchema),
    OnboardingState: registry.register('OnboardingState', onboardingStateSchema),
    Devices: registry.register('Devices', devicesResponseSchema),
    RevokedCount: registry.register('RevokedCount', z.object({ revoked: z.number().int() })),
    PhotoResult: registry.register('PhotoResult', z.object({ photoUrl: z.string().nullable() })),
    Spaces: registry.register('Spaces', spacesResponseSchema),
    ChannelDetail: registry.register('ChannelDetail', channelDetailSchema),
    MuteResult: registry.register('MuteResult', muteResponseSchema),
    ReadResult: registry.register('ReadResult', readResponseSchema),
  };

  const routes: RouteDef[] = [
    { operationId: 'lookupInstitution', method: 'get', path: '/institutions/{code}', summary: 'Resolve an institution code for sign-in', auth: false, params: ['code'], response: C.InstitutionLookup, errors: [404, 429] },
    { operationId: 'getConfig', method: 'get', path: '/config', summary: 'Institution configuration for the signed-in user', auth: true, response: C.Config, errors: [401, 503] },
    { operationId: 'signIn', method: 'post', path: '/auth/sign-in', summary: 'Sign in with institution, identifier and password', auth: false, body: C.SignInRequest, response: C.SignInResponse, errors: [400, 401, 403, 429, 503] },
    { operationId: 'refresh', method: 'post', path: '/auth/refresh', summary: 'Rotate the refresh token', auth: false, body: C.RefreshRequest, response: C.Tokens, errors: [400, 401] },
    { operationId: 'signOut', method: 'post', path: '/auth/sign-out', summary: 'Revoke this session', auth: true, status: 204, errors: [401] },
    { operationId: 'changePassword', method: 'post', path: '/auth/change-password', summary: 'Change password; revokes other sessions', auth: true, body: C.ChangePasswordRequest, status: 204, errors: [400, 401] },
    { operationId: 'getMe', method: 'get', path: '/me', summary: 'Identity card, account state, settings, institution', auth: true, response: C.Me, errors: [401, 403, 426, 503] },
    { operationId: 'getSettings', method: 'get', path: '/me/settings', summary: 'Notification and language settings', auth: true, response: C.Settings, errors: [401] },
    { operationId: 'updateSettings', method: 'patch', path: '/me/settings', summary: 'Update settings', auth: true, body: C.SettingsPatch, response: C.Settings, errors: [400, 401] },
    { operationId: 'advanceOnboarding', method: 'post', path: '/me/onboarding/advance', summary: 'Complete the current onboarding step', auth: true, body: C.OnboardingAdvance, response: C.OnboardingState, errors: [400, 401] },
    { operationId: 'listDevices', method: 'get', path: '/me/devices', summary: 'Signed-in devices', auth: true, response: C.Devices, errors: [401] },
    { operationId: 'revokeDevice', method: 'delete', path: '/me/devices/{id}', summary: 'Sign out one device', auth: true, params: ['id'], status: 204, errors: [401, 404] },
    { operationId: 'revokeOtherDevices', method: 'post', path: '/me/devices/revoke-others', summary: 'Sign out every other device', auth: true, response: C.RevokedCount, errors: [401] },
    { operationId: 'uploadPhoto', method: 'post', path: '/me/photo', summary: 'Upload a profile photo (multipart field "file")', auth: true, multipart: true, response: C.PhotoResult, errors: [400, 401, 503] },
    { operationId: 'listSpaces', method: 'get', path: '/spaces', summary: 'Grouped channel list', auth: true, response: C.Spaces, errors: [401] },
    { operationId: 'getChannel', method: 'get', path: '/channels/{id}', summary: 'Channel header and About', auth: true, params: ['id'], response: C.ChannelDetail, errors: [400, 401, 404] },
    { operationId: 'muteChannel', method: 'put', path: '/channels/{id}/mute', summary: 'Mute a channel', auth: true, params: ['id'], response: C.MuteResult, errors: [400, 401, 404] },
    { operationId: 'unmuteChannel', method: 'delete', path: '/channels/{id}/mute', summary: 'Unmute a channel', auth: true, params: ['id'], response: C.MuteResult, errors: [400, 401, 404] },
    { operationId: 'markChannelRead', method: 'post', path: '/channels/{id}/read', summary: 'Mark a channel read', auth: true, params: ['id'], response: C.ReadResult, errors: [400, 401, 404] },
  ];

  for (const r of routes) {
    const responses: Record<string, unknown> = {};
    const okStatus = r.status ?? 200;
    responses[String(okStatus)] = r.response ? { description: 'OK', ...json(r.response) } : { description: 'No content' };
    for (const code of r.errors) responses[String(code)] = { description: `Error ${code}`, ...json(C.ErrorEnvelope) };
    registry.registerPath({
      operationId: r.operationId,
      tags: ['mobile'],                    // one tag → one generated class, `MobileApi`
      method: r.method, path: r.path, summary: r.summary,
      ...(r.auth ? { security: [{ [bearerAuth.name]: [] }] } : {}),
      request: {
        ...(r.params ? { params: z.object(Object.fromEntries(r.params.map((p) => [p, z.string()]))) } : {}),
        ...(r.body ? { body: json(r.body) } : {}),
        ...(r.multipart ? { body: { content: { 'multipart/form-data': { schema: z.object({ file: z.string().openapi({ format: 'binary' }) }) } } } } : {}),
      },
      responses: responses as never,
    });
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Juvi Mobile API', version: '1.0.0', description: 'Contract for the Juvi Flutter app. Generated from the backend Zod schemas; do not edit by hand.' },
    servers: [{ url: '/api/juvi-app/v1' }],
  }) as unknown as Record<string, unknown>;
}

/** JSON with recursively sorted object keys and two-space indentation, so diffs are meaningful. */
export function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(sort(value), null, 2);
}
```

```ts
// backend/src/modules/juvi-app/openapi/generate.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { buildOpenApiDocument, stableStringify } from './document';

const out = resolve(__dirname, '../../../../../mobile/api/openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableStringify(buildOpenApiDocument()) + '\n');
console.log(`wrote ${out}`);
```

Add to `backend/package.json` scripts:

```json
"openapi:mobile": "ts-node -r dotenv/config src/modules/juvi-app/openapi/generate.ts"
```

Generate the committed contract:

Run: `cd backend && npm run openapi:mobile`
Expected: prints `wrote .../mobile/api/openapi.json`.

```yaml
# .github/workflows/contract.yml
# Fails when backend/src/modules/juvi-app changes without regenerating mobile/api/openapi.json.
name: contract

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  openapi-drift:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci --include=dev
      - name: Regenerate the mobile OpenAPI document
        run: npm run openapi:mobile -w backend
      - name: Fail on drift
        run: |
          git diff --exit-code -- mobile/api/openapi.json || {
            echo "::error::mobile/api/openapi.json is out of date. Run 'npm run openapi:mobile -w backend' and commit the result."; exit 1; }
```

- [ ] **Step 5: Run the test and typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app/openapi/__tests__/document.test.ts && npm run typecheck`
Expected: PASS (5 tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json package-lock.json backend/src/modules/juvi-app/openapi mobile/api/openapi.json .github/workflows/contract.yml
git commit -m "feat(juvi-app): OpenAPI 3.1 contract generated from Zod, committed under mobile/api with a CI drift check

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 23: Startup guard, seed, environment and docs

**Files:**
- Modify: `backend/src/app.ts:49-53` (after the payment-secret guard), `backend/src/seed.ts:3151-3166`, `backend/src/modules/juvi-app/accounts/provisioning-service.ts` (optional `temporaryPassword`), `.env.example`, `CLAUDE.md`
- Test: `backend/src/modules/juvi-app/__tests__/startup-guard.test.ts`

- [ ] **Step 1: Write the failing test for the guard helper**

```ts
// backend/src/modules/juvi-app/__tests__/startup-guard.test.ts
import { describe, it, expect } from 'vitest';
import { juviStartupProblems } from '../startup-guard';

describe('juviStartupProblems', () => {
  it('requires JUVI_CREDENTIAL_KEY in production only', () => {
    expect(juviStartupProblems({ NODE_ENV: 'production' })).toEqual(['JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)']);
    expect(juviStartupProblems({ NODE_ENV: 'production', JUVI_CREDENTIAL_KEY: Buffer.alloc(32, 1).toString('base64') })).toEqual([]);
    expect(juviStartupProblems({ NODE_ENV: 'development' })).toEqual([]);
  });
  it('rejects a key of the wrong length anywhere', () => {
    expect(juviStartupProblems({ NODE_ENV: 'development', JUVI_CREDENTIAL_KEY: 'c2hvcnQ=' })).toEqual(['JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/__tests__/startup-guard.test.ts`
Expected: FAIL with "Cannot find module '../startup-guard'".

- [ ] **Step 3: Implement the guard, wire it, extend the seed, document**

```ts
// backend/src/modules/juvi-app/startup-guard.ts
export function juviStartupProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const key = env.JUVI_CREDENTIAL_KEY;
  if (env.NODE_ENV === 'production' && !key) problems.push('JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)');
  if (key && Buffer.from(key, 'base64').length !== 32) problems.push('JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes');
  return problems;
}
```

`backend/src/app.ts` — after the `PAYMENT_WEBHOOK_SECRET` guard:

```ts
import { juviStartupProblems } from './modules/juvi-app/startup-guard';
// ...
// Juvi credential-export key: temporary passwords are encrypted at rest with it (spec §9).
for (const problem of juviStartupProblems(process.env)) {
  console.error(`FATAL: ${problem}`);
  process.exit(1);
}
```

`backend/src/modules/juvi-app/accounts/provisioning-service.ts` — add to `ProvisionPersonInput`:

```ts
  /** Seed/dev only: use this temporary password instead of generating one. */
  temporaryPassword?: string;
```

and replace both `temporaryPassword = generateTemporaryPassword();` lines with `temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();`.

`backend/src/seed.ts` — add imports near the other seed imports and a block after the RBAC policies seed and before `console.log('\nSeed complete!…')`:

```ts
import { seedChannelTemplates } from './shared/seed/channel-templates';
import { provisionPerson } from './modules/juvi-app/accounts/provisioning-service';
import { reconcileCollege } from './modules/juvi-app/spaces/reconcile-service';
// ...
  // ========================================================================
  // JUVI MOBILE APP — templates, one demo student + faculty, first reconcile
  // ========================================================================
  await College.updateOne({ _id: CID }, { $set: {
    'juvi.enabled': true,
    'juvi.accentColor': '#0B5FA5',
    'juvi.supportContact': { name: 'JIT Student Office', phone: '+91-40-2345-6789', email: 'office@jit.edu.in' },
  } });
  await seedChannelTemplates(String(CID));
  const DEMO_TEMP_PASSWORD = 'river-lamp-482';
  const demoStudent = await Student.findOne({ collegeId: CID, status: 'active', rollNumber: { $exists: true } }).sort({ rollNumber: 1 }).lean();
  const demoFaculty = await Faculty.findOne({ collegeId: CID, status: 'active' }).sort({ employeeCode: 1 }).lean();
  if (demoStudent) await provisionPerson({ collegeId: String(CID), personId: String(demoStudent.personId), kind: 'student', source: 'admin', performedBy: 'seed', temporaryPassword: DEMO_TEMP_PASSWORD });
  if (demoFaculty) await provisionPerson({ collegeId: String(CID), personId: String(demoFaculty.personId), kind: 'faculty', source: 'admin', performedBy: 'seed', temporaryPassword: DEMO_TEMP_PASSWORD });
  const juviSummary = await reconcileCollege(String(CID));
  console.log(`Juvi: ${juviSummary.channels.total} channels, ${juviSummary.memberships.added} memberships`);
  console.log(`Juvi demo sign-in — institution code JIT; student ${demoStudent?.rollNumber ?? '(none)'} / faculty ${demoFaculty?.employeeCode ?? '(none)'}; temporary password ${DEMO_TEMP_PASSWORD}`);
```

`.env.example` — append:

```
# Juvi mobile app
JUVI_CREDENTIAL_KEY=            # 32 bytes base64 (openssl rand -base64 32). Required in production; dev falls back to a fixed key.
JUVI_RECONCILE_INTERVAL_MINUTES=5
JUVI_IOS_STORE_URL=             # set once the iOS app is published
```

`CLAUDE.md` — add a section after "Student bulk import":

```markdown
### Juvi mobile app — `backend/src/modules/juvi-app/`

The student/faculty Flutter app (`mobile/`) talks to `/api/juvi-app/v1`, **not** to the ERP routes. Spec: `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md`.

- Own auth: `authenticateMobile` (15-min JWT with `typ: 'mobile'` + per-device `MobileSession` checked in Redis). Mobile routes never use `authorize()`; permission is per channel membership.
- Own error envelope `{ error: { code, message } }` via `MobileApiError`; controllers call `schema.parse(req.body)` themselves instead of `validate()`.
- Membership is **reconciled**, not event-driven: `spaces/reconcile-service.ts` runs a college pass every 5 minutes and an account pass on sign-in and Spaces refresh. Strategies are pure functions in `spaces/strategies.ts`.
- Temporary passwords never leave the server in plaintext: `accounts/credential-store.ts` encrypts them under `JUVI_CREDENTIAL_KEY` for 7 days; the admin console reveals them.
- The API contract `mobile/api/openapi.json` is generated (`npm run openapi:mobile -w backend`); CI fails on drift. Change a Zod schema → regenerate → commit.
- Dev seed enables Juvi on JIT and provisions one student and one faculty member with temporary password `river-lamp-482`.
```

- [ ] **Step 4: Run everything**

Run: `cd backend && npx vitest run && npx vitest run --config vitest.e2e.config.ts && npm run typecheck && cd .. && npm run typecheck`
Expected: all unit and integration suites PASS, both typechecks clean.

Then seed a local database and confirm the sign-in flow end to end against the running API:

Run: `cd backend && npm run seed && (npm run dev & sleep 8; curl -s localhost:3003/api/juvi-app/v1/institutions/JIT; echo; kill %1)`
Expected: the seed prints the demo credentials and a channel count; the curl returns the JIT institution JSON with `"accentColor": "#0B5FA5"`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/modules/juvi-app/startup-guard.ts backend/src/modules/juvi-app/__tests__/startup-guard.test.ts backend/src/modules/juvi-app/accounts/provisioning-service.ts backend/src/seed.ts .env.example CLAUDE.md
git commit -m "feat(juvi-app): production key guard, dev seed with demo accounts, env and CLAUDE.md docs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| §7 Data model | 1 |
| §8 Institution lookup, sign-in, tokens, middleware, other auth routes, deactivation | 5, 6, 7, 8, 10, 18; deactivation 9 |
| §9 provisionPerson, callers, credential export storage | 3, 4, 9, 19, 21 (export CSV route is Plan 2) |
| §9 Templates, strategies, reconcile, next class | 12, 13, 14, 15, 16 |
| §10 Mobile API v1, error envelope, contract, versioning | 2, 10, 11, 17, 18, 22 |
| §13 Self-scope fix | 20 |
| §14 Failure handling | 7 (Redis fallback), 15 (per-channel try/catch, lock), 19 (partial runs) |
| §15 Security and tenancy | 6 (hashed cooldown key), 8, 10 (dummy hash), 17 (404 for non-members) |
| §16 Backend tests, seed | every task; seed 23 |
| §17 Configuration, workers at startup | 19, 23 |
| §12 Admin portal, admin routes | **Plan 2** |
| §11 Flutter app | **Plan 3** |
