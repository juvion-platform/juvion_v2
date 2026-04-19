import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

// Service modules with $match aggregations that depend on the
// collegeId-ObjectId casting fix shipped in this PR.
import * as placementService from '../modules/placement/service';
import * as alumniService from '../modules/placement/alumni-service';
import * as exitService from '../modules/people/exit-service';
import * as mentCounsCcdService from '../modules/welfare/ment-couns-ccd-service';
import * as evidCritService from '../modules/compliance/evid-crit-service';

// Models used in the fixture seeds.
import { PlacementOffer } from '../models/placement/PlacementOffer';
import { AlumniCareerRecord } from '../models/placement/AlumniCareerRecord';
import { ClearanceWorkflow } from '../models/workflow/ClearanceWorkflow';
import { ClearanceItem } from '../models/workflow/ClearanceItem';
import { CounsellingReferral } from '../models/welfare/CounsellingReferral';
import { MentorSession } from '../models/welfare/MentorSession';
import { MentorConcern } from '../models/welfare/MentorConcern';
import { MentorAssignment } from '../models/welfare/MentorAssignment';
import { EvidenceRecord } from '../models/compliance/EvidenceRecord';

import { setupMongo, teardownMongo, clearCollections } from './helpers/mongoMemory';

/**
 * Cross-module lock-down: all the `$match: { collegeId }` aggregations that
 * previously used a raw string (silently returning zero) now pass with the
 * `new mongoose.Types.ObjectId(collegeId)` wrap.
 *
 * One test per module covers one representative aggregation. If any site
 * regresses to the buggy pattern, the corresponding test goes red because
 * the aggregation returns empty and the assertion fails.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('cross-module aggregate: collegeId ObjectId-casting regression guard', () => {
  // Extended hook timeouts because setupMongo() may need to download the
  // mongodb-memory-server binary on a fresh machine; 10s (vitest default)
  // is not enough.
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  // ── placement/service.getStats: avgPackageLpa aggregation ───────────
  it('placement.getStats averages packageLpa correctly (would be 0 pre-fix)', async () => {
    const cid = String(oid());
    // Two in-flight offers — packageLpa 10 and 20. Rejected one should NOT
    // count. Uses schema-valid status values: 'extended' (open), 'accepted',
    // 'rejected'.
    const common = {
      collegeId: cid, jobPostingId: oid(), studentId: oid(),
      companyId: oid(), offerDate: new Date(), source: 'campus',
    };
    await PlacementOffer.create([
      { ...common, packageLpa: 10, status: 'extended' },
      { ...common, packageLpa: 20, status: 'accepted' },
      { ...common, packageLpa: 999, status: 'rejected' },
    ]);
    const stats = await placementService.getStats(cid);
    expect(stats.avgPackageLpa).toBe(15);
    expect(stats.maxPackageLpa).toBe(20);
  });

  // ── placement/alumni-service.getAlumniAnalytics: statusBreakdown + topIndustries ──
  it('placement.getAlumniAnalytics groups careerStatus and industries', async () => {
    const cid = String(oid());
    const base = { collegeId: cid, personId: oid(), alumniProfileId: oid(), updateSource: 'self_report' as const };
    await AlumniCareerRecord.create([
      { ...base, personId: oid(), careerStatus: 'employed', industry: 'tech' },
      { ...base, personId: oid(), careerStatus: 'employed', industry: 'tech' },
      { ...base, personId: oid(), careerStatus: 'seeking', industry: 'finance' },
    ]);
    const analytics = await alumniService.getAlumniAnalytics(cid);
    const byStatus = Object.fromEntries(analytics.statusBreakdown.map((s) => [s.status, s.count]));
    expect(byStatus.employed).toBe(2);
    expect(byStatus.seeking).toBe(1);
    const byIndustry = Object.fromEntries(analytics.topIndustries.map((i) => [i.industry, i.count]));
    expect(byIndustry.tech).toBe(2);
    expect(byIndustry.finance).toBe(1);
  });

  // ── people/exit-service.getClearanceDashboard: workflowsByStatus + itemsByDeptStatus ──
  it('people.getClearanceDashboard returns populated buckets (would be empty pre-fix)', async () => {
    const cid = String(oid());
    const studentId = oid();
    const wf = await ClearanceWorkflow.create({
      collegeId: cid, studentId, initiatedBy: oid(), status: 'in_progress',
      exitType: 'graduation', initiatedAt: new Date(),
      totalItems: 1, completedItems: 0,
    } as unknown as Record<string, unknown>);
    await ClearanceItem.create({
      collegeId: cid, clearanceWorkflowId: wf._id, department: 'hostel',
      status: 'pending', assigneeRole: 'hostel_warden',
      slaHours: 48, slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
    } as unknown as Record<string, unknown>);

    const dash = await exitService.getClearanceDashboard(cid);
    // workflows has at least the one in_progress we seeded
    expect(dash.workflows.in_progress).toBeGreaterThanOrEqual(1);
    // items has the hostel/pending bucket populated
    expect(dash.items.hostel?.pending).toBeGreaterThanOrEqual(1);
  });

  // ── welfare/ment-couns-ccd-service.getFollowUpDashboard: CounsellingReferral agg ──
  it('welfare.getFollowUpDashboard groups by followUpStatus', async () => {
    const cid = String(oid());
    const base = {
      collegeId: cid, studentId: oid(), referredBy: oid(),
      referralSource: 'mentor' as const, appointmentDates: [],
    };
    await CounsellingReferral.create([
      { ...base, status: 'accepted', followUpStatus: 'on_track' },
      { ...base, status: 'accepted', followUpStatus: 'on_track' },
      { ...base, status: 'in_progress', followUpStatus: 'pending' },
      // completed/declined should be EXCLUDED from the dashboard
      { ...base, status: 'completed', followUpStatus: 'completed' },
      { ...base, status: 'declined', followUpStatus: 'missed' },
    ]);
    const dash = await mentCounsCcdService.getFollowUpDashboard(cid);
    expect(dash.on_track).toBe(2);
    expect(dash.pending).toBe(1);
    // These should be 0 — their parent referrals are filtered out
    expect(dash.completed).toBe(0);
    expect(dash.missed).toBe(0);
  });

  // ── welfare/ment-couns-ccd-service.getMentorEngagementAnalytics: sessions + concerns ──
  it('welfare.getMentorEngagementAnalytics counts sessions + concerns', async () => {
    const cid = String(oid());
    const mentorId = oid();
    const assignment = await MentorAssignment.create({
      collegeId: cid, mentorId, studentId: oid(),
      academicYearId: oid(), assignedDate: new Date(),
      assignedBy: oid(), status: 'active',
    });
    await MentorSession.create([
      { collegeId: cid, assignmentId: assignment._id, mentorId, studentId: oid(), sessionDate: new Date(), mode: 'in_person' },
      { collegeId: cid, assignmentId: assignment._id, mentorId, studentId: oid(), sessionDate: new Date(), mode: 'online' },
    ]);
    await MentorConcern.create([
      { collegeId: cid, mentorId, studentId: oid(), concernType: 'academic', description: 'low marks', severity: 'medium', status: 'open' },
      // MentorConcern.status enum: 'open' | 'addressed' | 'escalated' | 'closed'
      { collegeId: cid, mentorId, studentId: oid(), concernType: 'academic', description: 'ok', severity: 'medium', status: 'closed' },
    ]);
    const analytics = await mentCounsCcdService.getMentorEngagementAnalytics(cid);
    expect(analytics.totalSessions).toBe(2);
    // Actual return field is `concernsFlagged` (not concernsByStatus)
    expect((analytics.concernsFlagged as Record<string, number>).open).toBe(1);
    expect((analytics.concernsFlagged as Record<string, number>).closed).toBe(1);
  });

  // ── compliance/evid-crit-service.getEvidenceStats: byStatus + byModule ──
  it('compliance.getEvidenceStats groups records by status and sourceModule', async () => {
    const cid = String(oid());
    const base = {
      collegeId: cid, criterionCode: 'C1',
      evidenceType: 'other' as const, title: 't',
      sourceEntityType: 'Student', data: {},
    };
    await EvidenceRecord.create([
      { ...base, sourceModule: 'academics', status: 'collected' },
      { ...base, sourceModule: 'academics', status: 'verified' },
      { ...base, sourceModule: 'welfare', status: 'collected' },
    ]);
    const stats = await evidCritService.getEvidenceStats(cid);
    const byStatus = Object.fromEntries((stats.byStatus as Array<{ _id: string; count: number }>).map((s) => [s._id, s.count]));
    const byModule = Object.fromEntries((stats.byModule as Array<{ _id: string; count: number }>).map((m) => [m._id, m.count]));
    expect(byStatus.collected).toBe(2);
    expect(byStatus.verified).toBe(1);
    expect(byModule.academics).toBe(2);
    expect(byModule.welfare).toBe(1);
  });

  // Cross-tenant isolation proof — no data leakage between colleges
  it('aggregations remain college-scoped after the ObjectId cast', async () => {
    const cidA = String(oid());
    const cidB = String(oid());
    const common = {
      jobPostingId: oid(), studentId: oid(), companyId: oid(),
      offerDate: new Date(), source: 'campus' as const,
    };
    await PlacementOffer.create([
      { ...common, collegeId: cidA, packageLpa: 10, status: 'extended' },
      { ...common, collegeId: cidB, packageLpa: 99, status: 'extended' },
    ]);
    const statsA = await placementService.getStats(cidA);
    const statsB = await placementService.getStats(cidB);
    expect(statsA.avgPackageLpa).toBe(10);
    expect(statsB.avgPackageLpa).toBe(99);
  });
});
