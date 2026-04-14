import { Portfolio } from '../../models/student-dev/Portfolio';
import { PortfolioEntry } from '../../models/student-dev/PortfolioEntry';
import { ClubMembership } from '../../models/student-dev/ClubMembership';
import { EventRegistration } from '../../models/student-dev/EventRegistration';
import { Achievement } from '../../models/student-dev/Achievement';
import { LeadershipRole } from '../../models/student-dev/LeadershipRole';
import { SkillCertification } from '../../models/student-dev/SkillCertification';
import { StudentProject } from '../../models/student-dev/StudentProject';
import { CommunityProject } from '../../models/student-dev/CommunityProject';
import { NSSParticipant } from '../../models/student-dev/NSSParticipant';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ─── Constants ─────────────────────────────────────────────────
const SECTION_WEIGHTS: Record<string, number> = {
  leadership: 25,
  achievements: 25,
  certifications: 20,
  community: 15,
  events: 15,
};

const DEFAULT_SECTIONS = [
  { key: 'leadership', displayOrder: 1, isVisible: true },
  { key: 'achievements', displayOrder: 2, isVisible: true },
  { key: 'certifications', displayOrder: 3, isVisible: true },
  { key: 'community', displayOrder: 4, isVisible: true },
  { key: 'events', displayOrder: 5, isVisible: true },
  { key: 'clubs', displayOrder: 6, isVisible: true },
  { key: 'projects', displayOrder: 7, isVisible: true },
];

// ─── Portfolio Core ────────────────────────────────────────────

// 1. Get My Portfolio
export async function getMyPortfolio(collegeId: string, studentId: string) {
  const portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) return null;

  const entries = await PortfolioEntry.find({
    collegeId,
    portfolioId: portfolio._id,
  }).lean();

  return { ...portfolio.toObject(), entries };
}

// 2. Get Student Portfolio (public / faculty view)
export async function getStudentPortfolio(collegeId: string, studentId: string) {
  const portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const entries = await PortfolioEntry.find({
    collegeId,
    portfolioId: portfolio._id,
    isHidden: false,
  }).lean();

  return { ...portfolio.toObject(), entries };
}

// 3. Assemble Portfolio
export async function assemblePortfolio(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  // Find or create portfolio
  let portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) {
    portfolio = await Portfolio.create({
      collegeId,
      studentId,
      status: 'draft',
      sections: DEFAULT_SECTIONS,
    });
  }

  const portfolioId = portfolio._id;

  // Gather all student activities in parallel
  const [
    clubMemberships,
    leadershipRoles,
    eventRegistrations,
    achievements,
    certifications,
    studentProjects,
    communityProjects,
    nssParticipants,
  ] = await Promise.all([
    ClubMembership.find({ collegeId, studentId, status: 'active' }).populate('clubId').lean(),
    LeadershipRole.find({ collegeId, studentId }).lean(),
    EventRegistration.find({ collegeId, participantId: studentId, status: { $in: ['attended', 'winner'] } }).populate('eventId').lean(),
    Achievement.find({ collegeId, studentId, verificationStatus: { $in: ['verified', 'auto_verified'] } }).lean(),
    SkillCertification.find({ collegeId, studentId }).lean(),
    StudentProject.find({ collegeId, teamMembers: studentId, status: 'completed' }).lean(),
    CommunityProject.find({ collegeId, leadStudentId: studentId }).lean(),
    NSSParticipant.find({ collegeId, studentId, cumulativeHours: { $gt: 0 } }).lean(),
  ]);

  // Build candidate entries
  interface CandidateEntry {
    sourceType: string;
    sourceId: string;
    section: string;
    title: string;
    description?: string;
    skillTags: string[];
    date?: Date;
    signalStrength: 'high' | 'medium' | 'low';
  }

  const candidates: CandidateEntry[] = [];

  // Club memberships
  for (const m of clubMemberships) {
    const club = m.clubId as any;
    candidates.push({
      sourceType: 'club_membership',
      sourceId: String(m._id),
      section: 'clubs',
      title: `Member of ${club?.name ?? 'Club'}`,
      description: `Role: ${m.role}`,
      skillTags: [],
      date: m.joinedDate,
      signalStrength: 'medium',
    });
  }

  // Leadership roles
  for (const r of leadershipRoles) {
    candidates.push({
      sourceType: 'leadership',
      sourceId: String(r._id),
      section: 'leadership',
      title: `${r.role} — ${r.body}`,
      skillTags: [],
      date: r.startDate,
      signalStrength: 'high',
    });
  }

  // Event registrations
  for (const reg of eventRegistrations) {
    const evt = reg.eventId as any;
    candidates.push({
      sourceType: 'event_participation',
      sourceId: String(reg._id),
      section: 'events',
      title: evt?.name ?? 'Event',
      description: `Status: ${reg.status}`,
      skillTags: [],
      date: reg.registeredAt,
      signalStrength: reg.status === 'winner' ? 'high' : 'medium',
    });
  }

  // Achievements
  for (const a of achievements) {
    const isHighLevel = ['national', 'international'].includes(a.level);
    candidates.push({
      sourceType: 'achievement',
      sourceId: String(a._id),
      section: 'achievements',
      title: a.title,
      description: a.description,
      skillTags: a.skillTags ?? [],
      date: a.date,
      signalStrength: isHighLevel ? 'high' : 'medium',
    });
  }

  // Certifications
  for (const c of certifications) {
    candidates.push({
      sourceType: 'certification',
      sourceId: String(c._id),
      section: 'certifications',
      title: `${c.certificationName} (${c.provider})`,
      skillTags: c.skillTags ?? [],
      date: c.completedDate,
      signalStrength: 'medium',
    });
  }

  // Student projects
  for (const p of studentProjects) {
    candidates.push({
      sourceType: 'project',
      sourceId: String(p._id),
      section: 'projects',
      title: p.title,
      description: p.description,
      skillTags: p.technologies ?? [],
      signalStrength: 'medium',
    });
  }

  // Community projects
  for (const cp of communityProjects) {
    candidates.push({
      sourceType: 'community',
      sourceId: String(cp._id),
      section: 'community',
      title: cp.title,
      description: cp.description,
      skillTags: [],
      date: cp.startDate,
      signalStrength: 'medium',
    });
  }

  // NSS participants
  for (const np of nssParticipants) {
    candidates.push({
      sourceType: 'community',
      sourceId: String(np._id),
      section: 'community',
      title: `NSS Participation (${np.cumulativeHours} hours)`,
      skillTags: [],
      date: np.enrollmentDate,
      signalStrength: 'medium',
    });
  }

  // Check existing entries and create missing ones
  const existingEntries = await PortfolioEntry.find({ collegeId, portfolioId }).lean();
  const existingKeys = new Set(
    existingEntries.map((e) => `${e.sourceType}:${String(e.sourceId)}`),
  );

  const newEntries = candidates.filter(
    (c) => !existingKeys.has(`${c.sourceType}:${c.sourceId}`),
  );

  if (newEntries.length > 0) {
    await PortfolioEntry.insertMany(
      newEntries.map((e) => ({
        collegeId,
        portfolioId,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        section: e.section,
        title: e.title,
        description: e.description,
        skillTags: e.skillTags,
        date: e.date,
        signalStrength: e.signalStrength,
        isFeatured: false,
        isHidden: false,
        displayOrder: 0,
        evidenceUrls: [],
      })),
    );
  }

  // Compute and update completeness score
  const score = await scoreCompleteness(collegeId, String(portfolioId));
  portfolio.completenessScore = score;
  portfolio.lastCuratedDate = new Date();
  await portfolio.save();

  await createAuditLog({
    collegeId,
    entityType: 'Portfolio',
    entityId: String(portfolioId),
    entityName: `Portfolio for student ${studentId}`,
    action: 'update',
    changes: [
      { field: 'completenessScore', displayName: 'Completeness Score', oldValue: null, newValue: score },
      { field: 'entriesAdded', displayName: 'Entries Added', oldValue: null, newValue: newEntries.length },
    ],
    performedBy,
  });

  const allEntries = await PortfolioEntry.find({ collegeId, portfolioId }).lean();
  return { ...portfolio.toObject(), entries: allEntries };
}

// 4. Score Completeness
export async function scoreCompleteness(collegeId: string, portfolioId: string): Promise<number> {
  const entries = await PortfolioEntry.find({
    collegeId,
    portfolioId,
    isHidden: false,
  }).lean();

  const sectionCounts: Record<string, number> = {};
  for (const e of entries) {
    sectionCounts[e.section] = (sectionCounts[e.section] ?? 0) + 1;
  }

  // Check if there are any club entries (used for leadership partial score)
  const hasClubEntries = (sectionCounts['clubs'] ?? 0) > 0;

  const sectionScores: Record<string, number> = {};

  // Leadership: 100 if any leadership entry, 50 if any club membership, else 0
  const leadershipCount = sectionCounts['leadership'] ?? 0;
  if (leadershipCount > 0) {
    sectionScores['leadership'] = 100;
  } else if (hasClubEntries) {
    sectionScores['leadership'] = 50;
  } else {
    sectionScores['leadership'] = 0;
  }

  // Achievements: 100 if 3+, 50 if 1-2, else 0
  const achievementCount = sectionCounts['achievements'] ?? 0;
  if (achievementCount >= 3) {
    sectionScores['achievements'] = 100;
  } else if (achievementCount >= 1) {
    sectionScores['achievements'] = 50;
  } else {
    sectionScores['achievements'] = 0;
  }

  // Certifications: 100 if 3+, 50 if 1-2, else 0
  const certCount = sectionCounts['certifications'] ?? 0;
  if (certCount >= 3) {
    sectionScores['certifications'] = 100;
  } else if (certCount >= 1) {
    sectionScores['certifications'] = 50;
  } else {
    sectionScores['certifications'] = 0;
  }

  // Community: 100 if 2+, 50 if 1, else 0
  const communityCount = sectionCounts['community'] ?? 0;
  if (communityCount >= 2) {
    sectionScores['community'] = 100;
  } else if (communityCount >= 1) {
    sectionScores['community'] = 50;
  } else {
    sectionScores['community'] = 0;
  }

  // Events: 100 if 5+, 50 if 1-4, else 0
  const eventCount = sectionCounts['events'] ?? 0;
  if (eventCount >= 5) {
    sectionScores['events'] = 100;
  } else if (eventCount >= 1) {
    sectionScores['events'] = 50;
  } else {
    sectionScores['events'] = 0;
  }

  // Weighted average
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [section, weight] of Object.entries(SECTION_WEIGHTS)) {
    weightedSum += (sectionScores[section] ?? 0) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ─── Portfolio Entry Management ────────────────────────────────

// 5. List Portfolio Entries
export async function listPortfolioEntries(
  collegeId: string,
  portfolioId: string,
  page: number,
  limit: number,
) {
  return paginate(PortfolioEntry, { collegeId, portfolioId }, page, limit, { displayOrder: 1, createdAt: -1 });
}

// 6. Get Portfolio Entry
export async function getPortfolioEntry(collegeId: string, id: string) {
  const entry = await PortfolioEntry.findOne({ _id: id, collegeId });
  if (!entry) throw new AppError(404, 'Portfolio entry not found');
  return entry;
}

// 7. Update Portfolio Entry
export async function updatePortfolioEntry(
  collegeId: string,
  entryId: string,
  data: { isFeatured?: boolean; isHidden?: boolean; displayOrder?: number; description?: string; title?: string },
  performedBy: string,
) {
  const entry = await PortfolioEntry.findOne({ _id: entryId, collegeId });
  if (!entry) throw new AppError(404, 'Portfolio entry not found');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];

  if (data.isFeatured !== undefined && data.isFeatured !== entry.isFeatured) {
    changes.push({ field: 'isFeatured', displayName: 'Featured', oldValue: entry.isFeatured, newValue: data.isFeatured });
    entry.isFeatured = data.isFeatured;
  }
  if (data.isHidden !== undefined && data.isHidden !== entry.isHidden) {
    changes.push({ field: 'isHidden', displayName: 'Hidden', oldValue: entry.isHidden, newValue: data.isHidden });
    entry.isHidden = data.isHidden;
  }
  if (data.displayOrder !== undefined && data.displayOrder !== entry.displayOrder) {
    changes.push({ field: 'displayOrder', displayName: 'Display Order', oldValue: entry.displayOrder, newValue: data.displayOrder });
    entry.displayOrder = data.displayOrder;
  }
  if (data.description !== undefined && data.description !== entry.description) {
    changes.push({ field: 'description', displayName: 'Description', oldValue: entry.description, newValue: data.description });
    entry.description = data.description;
  }
  if (data.title !== undefined && data.title !== entry.title) {
    changes.push({ field: 'title', displayName: 'Title', oldValue: entry.title, newValue: data.title });
    entry.title = data.title;
  }

  await entry.save();

  await createAuditLog({
    collegeId,
    entityType: 'PortfolioEntry',
    entityId: String(entry._id),
    entityName: entry.title,
    action: 'update',
    changes,
    performedBy,
  });

  return entry;
}

// 8. Add Manual Entry
export async function addManualEntry(
  collegeId: string,
  data: { portfolioId: string; section: string; title: string; description?: string; skillTags?: string[]; date?: Date; evidenceUrls?: string[] },
  performedBy: string,
) {
  const entry = await PortfolioEntry.create({
    collegeId,
    portfolioId: data.portfolioId,
    sourceType: 'manual',
    section: data.section,
    title: data.title,
    description: data.description,
    skillTags: data.skillTags ?? [],
    date: data.date,
    evidenceUrls: data.evidenceUrls ?? [],
    verificationStatus: 'unverified',
    signalStrength: 'low',
    isFeatured: false,
    isHidden: false,
    displayOrder: 0,
  });

  await createAuditLog({
    collegeId,
    entityType: 'PortfolioEntry',
    entityId: String(entry._id),
    entityName: entry.title,
    action: 'create',
    changes: [{ field: 'sourceType', displayName: 'Source Type', oldValue: null, newValue: 'manual' }],
    performedBy,
  });

  return entry;
}

// ─── Portfolio Lifecycle ───────────────────────────────────────

// 9. Publish Portfolio
export async function publishPortfolio(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  const portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) throw new AppError(404, 'Portfolio not found');
  if (portfolio.status !== 'draft') {
    throw new AppError(400, 'Only draft portfolios can be published');
  }

  portfolio.status = 'published';
  portfolio.publishedDate = new Date();
  await portfolio.save();

  await createAuditLog({
    collegeId,
    entityType: 'Portfolio',
    entityId: String(portfolio._id),
    entityName: `Portfolio for student ${studentId}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'published' }],
    performedBy,
  });

  return portfolio;
}

// 10. Unpublish Portfolio
export async function unpublishPortfolio(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  const portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) throw new AppError(404, 'Portfolio not found');
  if (portfolio.status !== 'published') {
    throw new AppError(400, 'Only published portfolios can be unpublished');
  }

  portfolio.status = 'draft';
  await portfolio.save();

  await createAuditLog({
    collegeId,
    entityType: 'Portfolio',
    entityId: String(portfolio._id),
    entityName: `Portfolio for student ${studentId}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'published', newValue: 'draft' }],
    performedBy,
  });

  return portfolio;
}

// 11. Get Completeness and Gaps
export async function getCompletenessAndGaps(collegeId: string, studentId: string) {
  const portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  const score = await scoreCompleteness(collegeId, String(portfolio._id));

  // Determine which sections have zero entries
  const entries = await PortfolioEntry.find({
    collegeId,
    portfolioId: portfolio._id,
    isHidden: false,
  }).lean();

  const sectionCounts: Record<string, number> = {};
  for (const e of entries) {
    sectionCounts[e.section] = (sectionCounts[e.section] ?? 0) + 1;
  }

  const allSections = ['leadership', 'achievements', 'certifications', 'community', 'events', 'clubs', 'projects'];
  const missingAreas = allSections.filter((s) => (sectionCounts[s] ?? 0) === 0);

  // Generate recommendations
  const recommendationMap: Record<string, string> = {
    leadership: 'Take on a leadership role in a club or student council to strengthen your profile',
    achievements: 'Participate in competitions and hackathons to earn achievements',
    certifications: 'Complete online certifications in your domain to showcase technical skills',
    community: 'Engage in community service or NSS activities to demonstrate social responsibility',
    events: 'Attend and participate in campus events, workshops, and seminars',
    clubs: 'Join clubs aligned with your interests to build extracurricular experience',
    projects: 'Complete academic or personal projects to demonstrate practical skills',
  };

  const recommendations = missingAreas.map((area) => recommendationMap[area] ?? `Add entries for ${area}`);

  const gapAnalysis = { missingAreas, recommendations };

  // Update portfolio gap analysis
  portfolio.gapAnalysis = gapAnalysis;
  portfolio.completenessScore = score;
  await portfolio.save();

  return { score, gapAnalysis };
}

// 12. Finalise Portfolio
export async function finalisePortfolio(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  const portfolio = await Portfolio.findOne({ collegeId, studentId });
  if (!portfolio) throw new AppError(404, 'Portfolio not found');

  // Take snapshot
  const allEntries = await PortfolioEntry.find({
    collegeId,
    portfolioId: portfolio._id,
  }).lean();

  portfolio.snapshotDate = new Date();
  portfolio.snapshotData = allEntries;
  portfolio.status = 'archived';
  await portfolio.save();

  await createAuditLog({
    collegeId,
    entityType: 'Portfolio',
    entityId: String(portfolio._id),
    entityName: `Portfolio for student ${studentId}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: portfolio.status, newValue: 'archived' },
      { field: 'snapshotDate', displayName: 'Snapshot Date', oldValue: null, newValue: portfolio.snapshotDate },
    ],
    performedBy,
  });

  return portfolio;
}
