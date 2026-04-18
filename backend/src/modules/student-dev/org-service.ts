import { Club } from '../../models/student-dev/Club';
import { ClubMembership } from '../../models/student-dev/ClubMembership';
import { LeadershipRole } from '../../models/student-dev/LeadershipRole';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { Event } from '../../models/student-dev/Event';

// ─── 1. Propose Club ────────────────────────────────────────
export async function proposeClub(
  collegeId: string,
  data: { name: string; type: string; description?: string; objectives?: string; scope?: string; foundingMembers: string[] },
  performedBy: string,
) {
  if (data.foundingMembers.length < 5) {
    throw new AppError(400, 'A club proposal requires at least 5 founding members');
  }

  const duplicate = await Club.findOne({
    collegeId,
    name: data.name,
    status: { $in: ['active', 'proposed', 'approved'] },
  });
  if (duplicate) {
    throw new AppError(409, `A club named "${data.name}" already exists`);
  }

  // AI placeholder: simple proposal scoring 0-100
  let proposalScore = 0;
  const memberCount = data.foundingMembers.length;
  proposalScore += memberCount >= 10 ? 80 : 50 + (memberCount - 5) * 6;
  if (data.objectives) proposalScore += 10;
  if (data.description) proposalScore += 10;
  proposalScore = Math.min(proposalScore, 100);

  const club = await Club.create({
    collegeId,
    name: data.name,
    type: data.type,
    description: data.description,
    objectives: data.objectives,
    scope: data.scope ?? 'club',
    foundingMembers: data.foundingMembers,
    status: 'proposed',
    proposalScore,
  });

  await createAuditLog({
    collegeId,
    entityType: 'Club',
    entityId: String(club._id),
    entityName: club.name,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'proposed' }],
    performedBy,
  });

  return club;
}

// ─── 2. Approve Club ────────────────────────────────────────
export async function approveClub(
  collegeId: string,
  clubId: string,
  data: { approvedBy: string; facultyAdvisorId: string },
  performedBy: string,
) {
  const club = await Club.findOne({ _id: clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');
  if (club.status !== 'proposed') throw new AppError(400, 'Only proposed clubs can be approved');
  if (!data.facultyAdvisorId) throw new AppError(400, 'Faculty advisor is required for approval');

  const now = new Date();
  club.status = 'approved';
  club.approvedBy = data.approvedBy as any;
  club.approvalDate = now;
  club.advisorAssignedDate = now;
  club.facultyAdvisorId = data.facultyAdvisorId as any;
  club.isActive = true;
  await club.save();

  // Create founding memberships
  const memberOps = (club.foundingMembers ?? []).map((studentId) =>
    ClubMembership.create({
      collegeId,
      clubId: club._id,
      studentId,
      role: 'member',
      status: 'active',
      joinedDate: now,
    }),
  );
  await Promise.all(memberOps);

  await createAuditLog({
    collegeId,
    entityType: 'Club',
    entityId: String(club._id),
    entityName: club.name,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'proposed', newValue: 'approved' }],
    performedBy,
  });

  return club;
}

// ─── 3. Reject Club ─────────────────────────────────────────
export async function rejectClub(
  collegeId: string,
  clubId: string,
  data: { rejectedReason: string },
  performedBy: string,
) {
  const club = await Club.findOne({ _id: clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');
  if (club.status !== 'proposed') throw new AppError(400, 'Only proposed clubs can be rejected');

  club.status = 'rejected';
  club.rejectedReason = data.rejectedReason;
  await club.save();

  await createAuditLog({
    collegeId,
    entityType: 'Club',
    entityId: String(club._id),
    entityName: club.name,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'proposed', newValue: 'rejected' }],
    performedBy,
  });

  return club;
}

// ─── 4. Open Registration Window ────────────────────────────
export async function openRegistrationWindow(
  collegeId: string,
  data: { academicYearId: string; startDate: string; endDate: string },
  performedBy: string,
) {
  const window = {
    collegeId,
    academicYearId: data.academicYearId,
    startDate: data.startDate,
    endDate: data.endDate,
    isOpen: true,
  };

  await createAuditLog({
    collegeId,
    entityType: 'RegistrationWindow',
    entityId: data.academicYearId,
    entityName: `Registration Window ${data.startDate} - ${data.endDate}`,
    action: 'create',
    changes: [{ field: 'isOpen', displayName: 'Open', oldValue: null, newValue: true }],
    performedBy,
  });

  return window;
}

// ─── 5. Get Club Recommendations ────────────────────────────
export async function getClubRecommendations(collegeId: string, _studentId: string) {
  // Find clubs where student already has membership
  const existingMemberships = await ClubMembership.find({
    collegeId,
    studentId: _studentId,
    status: { $in: ['active', 'inactive'] },
  }).select('clubId');

  const memberClubIds = existingMemberships.map((m) => m.clubId);

  // Find active clubs the student is NOT in
  const clubs = await Club.find({
    collegeId,
    status: { $in: ['active', 'approved'] },
    _id: { $nin: memberClubIds },
  }).lean();

  // Get member counts for ranking
  const clubIds = clubs.map((c) => c._id);
  const memberCounts = await ClubMembership.aggregate([
    { $match: { collegeId, clubId: { $in: clubIds }, status: 'active' } },
    { $group: { _id: '$clubId', count: { $sum: 1 } } },
  ]);

  const countMap = new Map<string, number>(memberCounts.map((mc: { _id: string; count: number }) => [String(mc._id), mc.count]));

  const ranked: Array<{ name: string; type: string; description?: string; memberCount: number }> = clubs
    .map((c) => ({
      name: c.name,
      type: c.type,
      description: c.description,
      _id: c._id,
      memberCount: countMap.get(String(c._id)) ?? 0,
    }))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 5);

  return ranked;
}

// ─── 6. Apply For Membership ────────────────────────────────
export async function applyForMembership(
  collegeId: string,
  data: { clubId: string; studentId: string },
  performedBy: string,
) {
  const club = await Club.findOne({ _id: data.clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');
  if (!['active', 'approved'].includes(club.status)) {
    throw new AppError(400, 'Club is not accepting memberships');
  }

  const existing = await ClubMembership.findOne({
    collegeId,
    clubId: data.clubId,
    studentId: data.studentId,
    status: { $in: ['active', 'inactive'] },
  });
  if (existing) throw new AppError(409, 'Student is already a member of this club');

  // Open clubs auto-approve; structured clubs require selection
  const status = club.scope === 'club' ? 'active' : 'inactive';

  const membership = await ClubMembership.create({
    collegeId,
    clubId: data.clubId,
    studentId: data.studentId,
    role: 'member',
    status,
    joinedDate: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'ClubMembership',
    entityId: String(membership._id),
    entityName: `${club.name} membership`,
    action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: status }],
    performedBy,
  });

  return membership;
}

// ─── 7. Open Election ───────────────────────────────────────
export async function openElection(
  collegeId: string,
  clubId: string,
  data: { positions: { role: string; body: string }[]; academicYearId?: string },
  performedBy: string,
) {
  const club = await Club.findOne({ _id: clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');
  if (!['active', 'approved'].includes(club.status)) {
    throw new AppError(400, 'Elections can only be opened for active clubs');
  }

  const now = new Date();
  const roles = await Promise.all(
    data.positions.map((pos) =>
      LeadershipRole.create({
        collegeId,
        clubId,
        role: pos.role,
        body: pos.body,
        academicYearId: data.academicYearId ?? clubId, // fallback placeholder
        status: 'open',
        startDate: now,
        studentId: '000000000000000000000000', // placeholder until filled
      }),
    ),
  );

  await createAuditLog({
    collegeId,
    entityType: 'LeadershipRole',
    entityId: String(clubId),
    entityName: `${club.name} election`,
    action: 'create',
    changes: [{ field: 'positions', displayName: 'Positions', oldValue: null, newValue: data.positions.map((p) => p.role).join(', ') }],
    performedBy,
  });

  return roles;
}

// ─── 8. Cast Vote ───────────────────────────────────────────
export async function castVote(
  collegeId: string,
  clubId: string,
  data: { electionId: string; candidateId: string; voterId: string },
  _performedBy: string,
) {
  // Verify the election (leadership role) exists
  const election = await LeadershipRole.findOne({ _id: data.electionId, collegeId, clubId, status: 'open' });
  if (!election) throw new AppError(404, 'Election not found or already closed');

  // Placeholder: in a real system, record the vote in a separate Vote collection
  return { success: true, electionId: data.electionId, candidateId: data.candidateId, voterId: data.voterId };
}

// ─── 9. Appoint Position ────────────────────────────────────
export async function appointPosition(
  collegeId: string,
  clubId: string,
  data: { positionId: string; studentId: string; nominatedBy: string },
  performedBy: string,
) {
  const role = await LeadershipRole.findOne({ _id: data.positionId, collegeId, clubId });
  if (!role) throw new AppError(404, 'Leadership position not found');

  role.studentId = data.studentId as any;
  role.status = 'appointed';
  role.filledBy = 'appointment';
  role.nominatedBy = data.nominatedBy as any;
  await role.save();

  await createAuditLog({
    collegeId,
    entityType: 'LeadershipRole',
    entityId: String(role._id),
    entityName: role.role,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'open', newValue: 'appointed' },
      { field: 'studentId', displayName: 'Student', oldValue: null, newValue: data.studentId },
    ],
    performedBy,
  });

  return role;
}

// ─── 10. Transition Membership Status ───────────────────────
export async function transitionMembershipStatus(
  collegeId: string,
  membershipId: string,
  data: { status: 'active' | 'inactive' | 'alumni'; exitReason?: string },
  performedBy: string,
) {
  const membership = await ClubMembership.findOne({ _id: membershipId, collegeId });
  if (!membership) throw new AppError(404, 'Membership not found');

  const validTransitions: Record<string, string[]> = {
    active: ['inactive', 'alumni'],
    inactive: ['alumni'],
  };

  const allowed = validTransitions[membership.status] ?? [];
  if (!allowed.includes(data.status)) {
    throw new AppError(400, `Cannot transition from "${membership.status}" to "${data.status}"`);
  }

  const oldStatus = membership.status;
  membership.status = data.status;

  if (data.exitReason) membership.exitReason = data.exitReason;
  if (data.status === 'alumni') membership.exitDate = new Date();
  membership.lastActiveDate = new Date();

  await membership.save();

  await createAuditLog({
    collegeId,
    entityType: 'ClubMembership',
    entityId: String(membership._id),
    entityName: `Membership ${String(membership._id)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: data.status }],
    performedBy,
  });

  return membership;
}

// ─── 11. Get Club Health Report ─────────────────────────────
export async function getClubHealthReport(collegeId: string, clubId: string) {
  const club = await Club.findOne({ _id: clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [memberCount, eventCount, filledPositions, totalPositions] = await Promise.all([
    ClubMembership.countDocuments({ collegeId, clubId, status: 'active' }),
    Event.countDocuments({ collegeId, clubId, startDate: { $gte: oneYearAgo } }),
    LeadershipRole.countDocuments({ collegeId, clubId, status: { $in: ['appointed', 'elected', 'filled'] } }),
    LeadershipRole.countDocuments({ collegeId, clubId }),
  ]);

  // AI placeholder: compute health score 0-100
  let healthScore = 0;
  healthScore += Math.min(memberCount * 3, 30); // up to 30 points for members
  healthScore += Math.min(eventCount * 10, 40);  // up to 40 points for events
  if (totalPositions > 0) {
    healthScore += Math.round((filledPositions / totalPositions) * 30); // up to 30 points for leadership
  }
  healthScore = Math.min(healthScore, 100);

  return { memberCount, eventCount, filledPositions, totalPositions, healthScore };
}

// ─── 12. Submit Annual Review ───────────────────────────────
export async function submitAnnualReview(
  collegeId: string,
  clubId: string,
  data: { reviewNotes: string },
  performedBy: string,
) {
  const club = await Club.findOne({ _id: clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');

  const { healthScore } = await getClubHealthReport(collegeId, clubId);
  const oldStatus = club.status;

  if (healthScore > 50 && ['approved', 'dormant'].includes(club.status)) {
    club.status = 'active';
    club.dormancySince = undefined;
    club.isActive = true;
  } else if (healthScore <= 30 && club.status === 'active') {
    club.dormancySince = new Date();
  }

  await club.save();

  await createAuditLog({
    collegeId,
    entityType: 'Club',
    entityId: String(club._id),
    entityName: club.name,
    action: 'update',
    changes: [
      { field: 'annualReview', displayName: 'Annual Review', oldValue: null, newValue: data.reviewNotes },
      { field: 'healthScore', displayName: 'Health Score', oldValue: null, newValue: healthScore },
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: club.status },
    ],
    performedBy,
  });

  return { club, healthScore };
}

// ─── 13. Dissolve Club ──────────────────────────────────────
export async function dissolveClub(
  collegeId: string,
  clubId: string,
  data: { reason: string },
  performedBy: string,
) {
  const club = await Club.findOne({ _id: clubId, collegeId });
  if (!club) throw new AppError(404, 'Club not found');
  if (!['active', 'dormant'].includes(club.status)) {
    throw new AppError(400, 'Only active or dormant clubs can be dissolved');
  }

  const oldStatus = club.status;
  club.status = 'dissolved';
  club.isActive = false;
  await club.save();

  // Bulk transition all active memberships to alumni
  const now = new Date();
  await ClubMembership.updateMany(
    { collegeId, clubId, status: 'active' },
    { $set: { status: 'alumni', exitReason: 'club_dissolved', exitDate: now, lastActiveDate: now } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'Club',
    entityId: String(club._id),
    entityName: club.name,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'dissolved' },
      { field: 'reason', displayName: 'Dissolution Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return club;
}
