/**
 * Task 7 — fee-commitment-sheet-service tests.
 *
 * Covers the 10 AC scenarios from tasks.md §T7:
 *   1. Basic sheet — PDF generated + attached + pin updated
 *   2. Conditional components — included/excluded based on opt-in
 *   3. Active FeeAgreement reference block
 *   4. No PaymentPlan — payment-schedule block omitted (doesn't crash)
 *   5. Pin not found → 404
 *   6. FSI not found → throws with clear message
 *   7. Retry-friendly failure — createDocument throws → status='failed', error rethrown
 *   8. regenerateForPin — old doc marked superseded, new doc attached
 *   9. PDF byte-check — buffer > 0, starts with %PDF-
 *   10. Worker integration — calls generateSheet; rethrows on failure
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { College } from '../../../models/College';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Batch } from '../../../models/academic-structure/Batch';
import { FeeStructureInstance } from '../../../models/finance/FeeStructureInstance';
import { FeeComponent } from '../../../models/finance/FeeComponent';
import { FeeComponentRule } from '../../../models/finance/FeeComponentRule';
import { FeeAgreement } from '../../../models/finance/FeeAgreement';
import { ExitDocument } from '../../../models/people/ExitDocument';
import { AuditLog } from '../../../shared/audit';

// Mock the document-creation seam BEFORE importing the service.
// The service exports `__createCommitmentDocument` as its storage seam;
// tests replace it to avoid coupling to whatever durable store the
// production implementation uses.
vi.mock('../../../workers/fee-commitment.worker', async (orig) => {
  const actual = (await orig()) as typeof import('../../../workers/fee-commitment.worker');
  return {
    ...actual,
    enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  };
});

import * as svc from '../fee-commitment-sheet-service';

const oid = () => new mongoose.Types.ObjectId();

interface Scene {
  collegeId: mongoose.Types.ObjectId;
  studentId: string;
  pinId: string;
  fsiId: mongoose.Types.ObjectId;
}

async function buildScene(opts: {
  hostelOptIn?: boolean;
  withHostelComponent?: boolean;
  withAgreement?: boolean;
  skipFsi?: boolean;
  category?: string;
  quota?: string;
} = {}): Promise<Scene> {
  const collegeId = oid();
  const academicYearId = oid();

  await College.create({
    _id: collegeId,
    name: 'Acme Institute of Technology',
    code: 'AIT',
    address: { line1: '1 Campus Road', city: 'Hyderabad', state: 'TS', pincode: '500001' },
    contactEmail: 'hello@acme.edu',
    contactPhone: '9999999999',
  });

  const programme = await Programme.create({
    collegeId,
    code: 'BTECH',
    name: 'B.Tech',
    level: 'UG',
    durationYears: 4,
    regulationId: oid(),
  });

  const branch = await Branch.create({
    collegeId,
    code: 'CSE',
    name: 'Computer Science',
    programmeId: programme._id,
    intake: 60,
  });

  const batch = await Batch.create({
    collegeId,
    code: 'BATCH-2025',
    name: 'Batch 2025',
    admissionYear: 2025,
    programmeId: programme._id,
    regulationId: oid(),
  });

  const person = await Person.create({
    collegeId,
    name: 'Alice Student',
    phone: '8888888888',
  });

  let fsiId = oid();
  if (!opts.skipFsi) {
    const fsi = await FeeStructureInstance.create({
      _id: fsiId,
      collegeId,
      academicYearId,
      programmeId: programme._id,
      branchId: branch._id,
      category: opts.category ?? 'OC',
      quota: opts.quota ?? 'convener',
      status: 'active',
      totalAmount: 100000,
      approvedAt: new Date(),
    });
    fsiId = fsi._id as mongoose.Types.ObjectId;

    // Unconditional components.
    await FeeComponent.create({
      collegeId,
      feeStructureInstanceId: fsi._id,
      name: 'Tuition Fee',
      amount: 80000,
      isRefundable: false,
      componentType: 'tuition',
      isConditional: false,
      displayOrder: 1,
    });
    await FeeComponent.create({
      collegeId,
      feeStructureInstanceId: fsi._id,
      name: 'Library Fee',
      amount: 5000,
      isRefundable: false,
      componentType: 'library',
      isConditional: false,
      displayOrder: 2,
    });

    if (opts.withHostelComponent) {
      const hostel = await FeeComponent.create({
        collegeId,
        feeStructureInstanceId: fsi._id,
        name: 'Hostel Fee',
        amount: 40000,
        isRefundable: false,
        componentType: 'hostel',
        isConditional: true,
        displayOrder: 3,
      });
      // Rule: include only if student opted in to hostel.
      await FeeComponentRule.create({
        collegeId,
        feeComponentId: hostel._id,
        conditionType: 'hostel',
        conditionValue: 'true',
        operator: 'equals',
        status: 'configured',
      });
    }
  }

  const student = await Student.create({
    collegeId,
    personId: person._id,
    admissionYear: 2025,
    programmeId: programme._id,
    branchId: branch._id,
    batchId: batch._id,
    quota: opts.quota ?? 'convener',
    category: opts.category ?? 'OC',
    rollNumber: 'AIT25CSE001',
    status: 'active',
    feePins: [],
  });

  // Attach a pin pointing at the fsi (or a dummy ObjectId for skipFsi case).
  student.feePins.push({
    yearOfStudy: 1,
    feeStructureInstanceId: fsiId,
    pinnedAt: new Date(),
    pinnedBy: 'system:admission',
    reason: 'initial',
    archivedAt: null,
  } as never);
  await student.save();

  if (opts.withAgreement) {
    await FeeAgreement.create({
      collegeId,
      studentId: student._id,
      feeStructureInstanceId: fsiId,
      negotiatedTotal: 70000,
      baseTotal: 85000,
      waiverAmount: 15000,
      approvalAuthority: 'principal',
      validityPeriodYears: 4,
      status: 'active',
    });
  }

  // Stash hostel opt-in directly on the student's batchId context isn't
  // appropriate — instead we'll let callers pass it through generateSheet
  // opts later. For now we signal via a side-channel on the student: we
  // simulate "opt-in" by setting a field the service reads. The simplest
  // approach is to put the flag on Student.onboardingChecklist (harmless)
  // OR tag via a cache. The service reads opt-in via an optional
  // `studentOptIns` block we'll pass explicitly in tests — see the
  // generateSheet opts arg. (We don't mutate the model to add a field.)
  void opts.hostelOptIn; // opt-ins fed through the service's optional opts arg

  return {
    collegeId,
    studentId: String(student._id),
    pinId: String(student.feePins[student.feePins.length - 1]!._id),
    fsiId,
  };
}

describe('fee-commitment-sheet-service', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    // Reset the createDocument seam so one test's stub doesn't leak.
    if (typeof svc.__resetCreateDocumentForTests === 'function') {
      svc.__resetCreateDocumentForTests();
    }
  });

  // ── 1 ─────────────────────────────────────────────────────────────
  it('basic sheet — PDF generated, components rendered, pin updated to generated', async () => {
    const scene = await buildScene();
    const res = await svc.generateSheet(scene.studentId, scene.pinId);
    expect(res.documentId).toBeTruthy();
    expect(Buffer.isBuffer(res.pdfBuffer)).toBe(true);
    expect(res.pdfBuffer.length).toBeGreaterThan(0);

    // Pin updated.
    const s = await Student.findById(scene.studentId);
    const pin = s!.feePins.find((p) => String(p._id) === scene.pinId)!;
    expect(String(pin.commitmentSheetDocumentId)).toBe(String(res.documentId));
    expect(pin.commitmentSheetStatus).toBe('generated');

    // Audit entry on creation.
    const audits = await AuditLog.find({ entityType: 'Student', action: 'create' });
    // at least one audit for this generation exists
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2 ─────────────────────────────────────────────────────────────
  it('conditional components — hostel included only when opted in', async () => {
    // opted OUT
    const a = await buildScene({ withHostelComponent: true });
    const resOut = await svc.generateSheet(a.studentId, a.pinId, {
      studentOptIns: { hostel: false, transport: false },
    });
    const textOut = extractPdfText(resOut.pdfBuffer);
    expect(textOut).toContain('Tuition Fee');
    expect(textOut).toContain('Library Fee');
    expect(textOut).not.toContain('Hostel Fee');

    await clearCollections();

    // opted IN
    const b = await buildScene({ withHostelComponent: true });
    const resIn = await svc.generateSheet(b.studentId, b.pinId, {
      studentOptIns: { hostel: true, transport: false },
    });
    const textIn = extractPdfText(resIn.pdfBuffer);
    expect(textIn).toContain('Hostel Fee');
  });

  // ── 3 ─────────────────────────────────────────────────────────────
  it('active FeeAgreement — PDF shows the reference block with negotiatedTotal', async () => {
    const scene = await buildScene({ withAgreement: true });
    const res = await svc.generateSheet(scene.studentId, scene.pinId);
    const text = extractPdfText(res.pdfBuffer);
    expect(text.toLowerCase()).toContain('agreement');
    // negotiatedTotal = 70000
    expect(text).toContain('70000');
  });

  // ── 4 ─────────────────────────────────────────────────────────────
  it('no PaymentPlan linked — renders without crashing', async () => {
    const scene = await buildScene();
    const res = await svc.generateSheet(scene.studentId, scene.pinId);
    expect(res.documentId).toBeTruthy();
    expect(res.pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  // ── 5 ─────────────────────────────────────────────────────────────
  it('pin not found — throws 404', async () => {
    const scene = await buildScene();
    const bogusPinId = String(oid());
    await expect(svc.generateSheet(scene.studentId, bogusPinId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  // ── 5b ────────────────────────────────────────────────────────────
  it('student not found — throws 404', async () => {
    const bogusStudentId = String(oid());
    const bogusPinId = String(oid());
    await expect(svc.generateSheet(bogusStudentId, bogusPinId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  // ── 6 ─────────────────────────────────────────────────────────────
  it('FSI referenced by pin does not exist — throws with clear message + pin flagged failed', async () => {
    const scene = await buildScene({ skipFsi: true });
    await expect(svc.generateSheet(scene.studentId, scene.pinId)).rejects.toThrow(
      /FeeStructureInstance/i,
    );
    const s = await Student.findById(scene.studentId);
    const pin = s!.feePins.find((p) => String(p._id) === scene.pinId)!;
    expect(pin.commitmentSheetStatus).toBe('failed');
  });

  // ── 7 ─────────────────────────────────────────────────────────────
  it('retry-friendly failure — createDocument throws → pin.commitmentSheetStatus=failed, rethrows', async () => {
    const scene = await buildScene();
    svc.__setCreateDocumentForTests(async () => {
      throw new Error('blob-store-down');
    });
    await expect(svc.generateSheet(scene.studentId, scene.pinId)).rejects.toThrow(
      /blob-store-down/,
    );
    const s = await Student.findById(scene.studentId);
    const pin = s!.feePins.find((p) => String(p._id) === scene.pinId)!;
    expect(pin.commitmentSheetStatus).toBe('failed');
  });

  // ── 8 ─────────────────────────────────────────────────────────────
  it('regenerateForPin — old document superseded, new document attached', async () => {
    const scene = await buildScene();
    const first = await svc.generateSheet(scene.studentId, scene.pinId);
    const second = await svc.regenerateForPin(scene.studentId, scene.pinId);

    expect(String(second.documentId)).not.toBe(String(first.documentId));

    const s = await Student.findById(scene.studentId);
    const pin = s!.feePins.find((p) => String(p._id) === scene.pinId)!;
    expect(String(pin.commitmentSheetDocumentId)).toBe(String(second.documentId));

    // Old document marked superseded.
    const oldDoc = await ExitDocument.findById(first.documentId);
    expect(oldDoc).toBeTruthy();
    expect(oldDoc!.status).toBe('revoked');
    expect(oldDoc!.revokedReason).toMatch(/supersed/i);
  });

  // ── 9 ─────────────────────────────────────────────────────────────
  it('PDF byte-check — buffer > 0 and starts with %PDF-', async () => {
    const scene = await buildScene();
    const res = await svc.generateSheet(scene.studentId, scene.pinId);
    expect(res.pdfBuffer.length).toBeGreaterThan(100);
    expect(res.pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
  });

  // ── 10 ────────────────────────────────────────────────────────────
  it('worker integration — feeCommitmentWorker calls generateSheet and rethrows on failure', async () => {
    const { feeCommitmentWorker } = await import('../../../workers/fee-commitment.worker');

    const scene = await buildScene();

    // Happy path — worker runs generateSheet.
    const spy = vi.spyOn(svc, 'generateSheet');
    await feeCommitmentWorker({
      data: { studentId: scene.studentId, pinId: scene.pinId },
      id: 'w1',
    } as never);
    expect(spy).toHaveBeenCalledWith(scene.studentId, scene.pinId);

    // Failure path — generateSheet throws → worker rethrows.
    spy.mockRejectedValueOnce(new Error('boom'));
    await expect(
      feeCommitmentWorker({
        data: { studentId: scene.studentId, pinId: scene.pinId },
        id: 'w2',
      } as never),
    ).rejects.toThrow('boom');
  });
});

// ── Helper: extract visible text from an uncompressed PDF buffer ──
// Mirrors the approach in PdfRenderer.test.ts so assertions stay in
// lockstep with how pdfkit emits content streams.
function extractPdfText(buf: Buffer): string {
  const s = buf.toString('latin1');
  let out = '';
  const hexRe = /<([0-9a-fA-F\s]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(s)) !== null) {
    const cleaned = m[1]!.replace(/\s+/g, '');
    if (cleaned.length === 0 || cleaned.length % 2 !== 0) continue;
    let decoded = '';
    for (let i = 0; i < cleaned.length; i += 2) {
      decoded += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16));
    }
    out += decoded;
  }
  const litRe = /\(((?:\\.|[^()\\])*)\)\s*Tj/g;
  while ((m = litRe.exec(s)) !== null) {
    out += m[1]!.replace(/\\(.)/g, '$1');
  }
  return out;
}
