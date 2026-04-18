import { CareerProfile } from '../../models/placement/CareerProfile';
import { PlacementReadinessScore } from '../../models/placement/PlacementReadinessScore';
import { SkillRecord } from '../../models/placement/SkillRecord';
import { PlacementTraining } from '../../models/placement/PlacementTraining';
import { TrainingAttendance } from '../../models/placement/TrainingAttendance';
import { MockInterview } from '../../models/placement/MockInterview';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ═══════════════════════════════════════════════════════════════
// W04: Career Profile, Readiness Scoring, Skill Records, Training
// ═══════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Career Profile
// ---------------------------------------------------------------------------

/** W04-01: List career profiles with optional season/status filter */
export async function listCareerProfiles(
  collegeId: string,
  page = 1,
  limit = 20,
  placementSeasonId?: string,
  status?: string,
) {
  const filter: any = { collegeId };
  if (placementSeasonId) filter.placementSeasonId = placementSeasonId;
  if (status) filter.status = status;
  return paginate(CareerProfile, filter, page, limit, { createdAt: -1 }, ['studentId', 'placementSeasonId']);
}

/** W04-02: Get a single career profile by id */
export async function getCareerProfile(collegeId: string, id: string) {
  const doc = await CareerProfile.findOne({ _id: id, collegeId }).populate('studentId placementSeasonId');
  if (!doc) throw new AppError(404, 'Career profile not found');
  return doc;
}

/** W04-03: Get career profile by student + season (returns null if not found) */
export async function getCareerProfileByStudent(
  collegeId: string,
  studentId: string,
  placementSeasonId: string,
) {
  const doc = await CareerProfile.findOne({ collegeId, studentId, placementSeasonId });
  return doc;
}

/** W04-04: Batch-initialise career profiles for a season's students */
export async function initCareerProfiles(
  collegeId: string,
  data: { placementSeasonId: string; studentIds: string[] },
  performedBy: string,
) {
  const docs = data.studentIds.map((studentId) => ({
    collegeId,
    placementSeasonId: data.placementSeasonId,
    studentId,
    status: 'draft',
    academicSummary: {
      cgpa: 0,
      activeBacklogs: 0,
      programme: '',
      branch: '',
      regulation: '',
      lastResultSemester: 0,
    },
    careerPreferences: {
      targetRoles: [],
      preferredLocations: [],
      expectedCtcLpa: 0,
      willingToRelocate: false,
    },
    cocurricularHighlights: [],
    profileCompletenessScore: 0,
  }));

  const created = await CareerProfile.insertMany(docs, { ordered: false });

  await createAuditLog({
    collegeId,
    entityType: 'CareerProfile',
    entityId: data.placementSeasonId,
    entityName: `Batch init ${created.length} profiles`,
    action: 'create',
    changes: [{ field: 'count', displayName: 'Profiles Created', oldValue: null, newValue: created.length }],
    performedBy,
  });

  return { createdCount: created.length };
}

/** W04-05: Update career profile and compute completeness score */
export async function updateCareerProfile(
  collegeId: string,
  profileId: string,
  data: any,
  performedBy: string,
) {
  const doc = await CareerProfile.findOne({ _id: profileId, collegeId });
  if (!doc) throw new AppError(404, 'Career profile not found');

  Object.assign(doc, data);

  // Compute profile completeness score
  let score = 0;
  if (doc.academicSummary && (doc.academicSummary.cgpa > 0 || doc.academicSummary.programme)) score += 20;
  if (doc.careerPreferences?.targetRoles?.length > 0) score += 20;
  if (doc.careerPreferences?.preferredLocations?.length > 0) score += 10;
  if (doc.cocurricularHighlights?.length > 0) score += 20;
  if (doc.photoUrl) score += 10;

  doc.profileCompletenessScore = score;

  if (score >= 80) {
    doc.status = 'complete';
  } else if (score >= 40) {
    doc.status = 'incomplete';
  } else {
    doc.status = 'draft';
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'CareerProfile',
    entityId: String(doc._id),
    entityName: `Profile ${String(doc.studentId)}`,
    action: 'update',
    changes: [{ field: 'profileCompletenessScore', displayName: 'Completeness Score', oldValue: null, newValue: score }],
    performedBy,
  });

  return doc;
}

/** W04-06: Validate a cocurricular highlight item */
export async function validateProfileItem(
  collegeId: string,
  profileId: string,
  data: { itemIndex: number; validated: boolean },
  performedBy: string,
) {
  const doc = await CareerProfile.findOne({ _id: profileId, collegeId });
  if (!doc) throw new AppError(404, 'Career profile not found');

  if (!doc.cocurricularHighlights || data.itemIndex >= doc.cocurricularHighlights.length) {
    throw new AppError(400, 'Invalid item index');
  }

  // Mark the specific highlight as validated
  const highlight = doc.cocurricularHighlights[data.itemIndex]!;
  (highlight as any).validated = data.validated;
  doc.markModified('cocurricularHighlights');

  // Check if all items are validated
  const allValidated = doc.cocurricularHighlights.every((h: any) => h.validated === true);
  if (allValidated && doc.cocurricularHighlights.length > 0) {
    doc.status = 'validated';
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'CareerProfile',
    entityId: String(doc._id),
    entityName: `Profile ${String(doc.studentId)}`,
    action: 'update',
    changes: [{ field: `cocurricularHighlights[${data.itemIndex}].validated`, displayName: 'Item Validated', oldValue: null, newValue: data.validated }],
    performedBy,
  });

  return doc;
}

/** W04-07: Refresh academic data from M03 (placeholder for cross-module read) */
export async function refreshAcademicData(
  collegeId: string,
  profileId: string,
  data: { cgpa: number; activeBacklogs: number; lastResultSemester: number },
  performedBy: string,
) {
  const doc = await CareerProfile.findOne({ _id: profileId, collegeId });
  if (!doc) throw new AppError(404, 'Career profile not found');

  // Placeholder: in production, this would read from M03 Academics module
  doc.academicSummary.cgpa = data.cgpa;
  doc.academicSummary.activeBacklogs = data.activeBacklogs;
  doc.academicSummary.lastResultSemester = data.lastResultSemester;
  doc.markModified('academicSummary');
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'CareerProfile',
    entityId: String(doc._id),
    entityName: `Profile ${String(doc.studentId)}`,
    action: 'update',
    changes: [
      { field: 'academicSummary.cgpa', displayName: 'CGPA', oldValue: null, newValue: data.cgpa },
      { field: 'academicSummary.activeBacklogs', displayName: 'Active Backlogs', oldValue: null, newValue: data.activeBacklogs },
      { field: 'academicSummary.lastResultSemester', displayName: 'Last Result Semester', oldValue: null, newValue: data.lastResultSemester },
    ],
    performedBy,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// Readiness Scoring
// ---------------------------------------------------------------------------

/** W04-08: List readiness scores with optional season/category filter */
export async function listReadinessScores(
  collegeId: string,
  page = 1,
  limit = 20,
  placementSeasonId?: string,
  category?: string,
) {
  const filter: any = { collegeId };
  if (placementSeasonId) filter.placementSeasonId = placementSeasonId;
  if (category) filter.category = category;
  return paginate(PlacementReadinessScore, filter, page, limit, { overall: -1 }, ['studentId']);
}

/** W04-09: Get readiness score for a student in a season (returns null if not found) */
export async function getReadinessScore(
  collegeId: string,
  studentId: string,
  placementSeasonId: string,
) {
  const doc = await PlacementReadinessScore.findOne({ collegeId, studentId, placementSeasonId });
  return doc;
}

/** W04-10: Compute readiness score for a student */
export async function computeReadinessScore(
  collegeId: string,
  studentId: string,
  placementSeasonId: string,
  performedBy: string,
) {
  // Get or create the readiness score document
  let doc = await PlacementReadinessScore.findOne({ collegeId, studentId, placementSeasonId });
  if (!doc) {
    doc = new PlacementReadinessScore({ collegeId, studentId, placementSeasonId });
  }

  // Get skill records grouped by category
  const skillRecords = await SkillRecord.find({ collegeId, studentId });
  const byCategory: Record<string, number[]> = {};
  for (const sr of skillRecords) {
    if (sr.score != null) {
      if (!byCategory[sr.category]) byCategory[sr.category] = [];
      byCategory[sr.category]!.push(sr.score);
    }
  }

  const avg = (arr?: number[]) => (arr && arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // Compute component scores
  const aptitude = avg(byCategory['aptitude']);
  const technical = avg(byCategory['technical']);
  const softSkills = avg(byCategory['soft_skills']);

  // Profile completeness from CareerProfile
  const profile = await CareerProfile.findOne({ collegeId, studentId, placementSeasonId });
  const profileCompleteness = profile?.profileCompletenessScore ?? 0;

  // Latest mock interview rating (scale 1-5 -> 20-100)
  const latestMock = await MockInterview.findOne({ collegeId, studentId })
    .sort({ date: -1 })
    .lean();
  const mockInterviewScore = latestMock?.rating != null ? latestMock.rating * 20 : undefined;

  doc.components = {
    aptitude,
    technical,
    softSkills,
    profileCompleteness,
    mockInterview: mockInterviewScore,
  };

  // Apply weights
  let weights: { aptitude: number; technical: number; softSkills: number; profileCompleteness: number };
  if (mockInterviewScore != null) {
    // Split profileCompleteness weight 50/50 with mockInterview
    weights = { aptitude: 0.30, technical: 0.30, softSkills: 0.20, profileCompleteness: 0.10 };
    const overall =
      aptitude * weights.aptitude +
      technical * weights.technical +
      softSkills * weights.softSkills +
      profileCompleteness * weights.profileCompleteness +
      mockInterviewScore * 0.10;
    doc.overall = Math.round(overall * 100) / 100;
  } else {
    weights = { aptitude: 0.30, technical: 0.30, softSkills: 0.20, profileCompleteness: 0.20 };
    const overall =
      aptitude * weights.aptitude +
      technical * weights.technical +
      softSkills * weights.softSkills +
      profileCompleteness * weights.profileCompleteness;
    doc.overall = Math.round(overall * 100) / 100;
  }

  doc.weights = weights;

  // Categorise
  if (doc.overall >= 70) {
    doc.category = 'ready';
  } else if (doc.overall >= 40) {
    doc.category = 'needs_improvement';
  } else {
    doc.category = 'at_risk';
  }

  doc.lastComputedAt = new Date();
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementReadinessScore',
    entityId: String(doc._id),
    entityName: `Readiness ${String(studentId)}`,
    action: doc.isNew ? 'create' : 'update',
    changes: [
      { field: 'overall', displayName: 'Overall Score', oldValue: null, newValue: doc.overall },
      { field: 'category', displayName: 'Category', oldValue: null, newValue: doc.category },
    ],
    performedBy,
  });

  return doc;
}

/** W04-11: Batch compute readiness for all students in a season */
export async function computeBatchReadiness(
  collegeId: string,
  placementSeasonId: string,
  performedBy: string,
) {
  const profiles = await CareerProfile.find({ collegeId, placementSeasonId }).lean();

  let ready = 0;
  let needsImprovement = 0;
  let atRisk = 0;

  for (const profile of profiles) {
    const result = await computeReadinessScore(
      collegeId,
      String(profile.studentId),
      placementSeasonId,
      performedBy,
    );
    if (result.category === 'ready') ready++;
    else if (result.category === 'needs_improvement') needsImprovement++;
    else atRisk++;
  }

  return {
    total: profiles.length,
    ready,
    needsImprovement,
    atRisk,
  };
}

// ---------------------------------------------------------------------------
// Skill Records
// ---------------------------------------------------------------------------

/** W04-12: List skill records for a student with optional category filter */
export async function listSkillRecords(
  collegeId: string,
  studentId: string,
  page = 1,
  limit = 20,
  category?: string,
) {
  const filter: any = { collegeId, studentId };
  if (category) filter.category = category;
  return paginate(SkillRecord, filter, page, limit, { createdAt: -1 });
}

/** W04-13: Get a single skill record */
export async function getSkillRecord(collegeId: string, id: string) {
  const doc = await SkillRecord.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Skill record not found');
  return doc;
}

/** W04-14: Create a skill record */
export async function createSkillRecord(
  collegeId: string,
  data: {
    studentId: string;
    skillName: string;
    category: string;
    source: string;
    score?: number;
    percentile?: number;
    vendor?: string;
    assessedAt?: Date;
  },
  performedBy: string,
) {
  const doc = await SkillRecord.create({
    ...data,
    collegeId,
    verificationStatus: 'unverified',
  });

  await createAuditLog({
    collegeId,
    entityType: 'SkillRecord',
    entityId: String(doc._id),
    entityName: doc.skillName,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

/** W04-15: Update a skill record */
export async function updateSkillRecord(
  collegeId: string,
  id: string,
  data: any,
  performedBy: string,
) {
  const doc = await SkillRecord.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Skill record not found');

  await createAuditLog({
    collegeId,
    entityType: 'SkillRecord',
    entityId: String(doc._id),
    entityName: doc.skillName,
    action: 'update',
    changes: [],
    performedBy,
  });

  return doc;
}

/** W04-16: Delete a skill record */
export async function deleteSkillRecord(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await SkillRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Skill record not found');

  await createAuditLog({
    collegeId,
    entityType: 'SkillRecord',
    entityId: String(doc._id),
    entityName: doc.skillName,
    action: 'delete',
    changes: [],
    performedBy,
  });

  return doc;
}

/** W04-17: Ingest external assessment results in bulk */
export async function ingestExternalAssessment(
  collegeId: string,
  data: {
    studentId: string;
    vendor: string;
    skills: { skillName: string; category: string; score: number; percentile?: number }[];
  },
  performedBy: string,
) {
  const docs = data.skills.map((skill) => ({
    collegeId,
    studentId: data.studentId,
    vendor: data.vendor,
    source: 'assessment' as const,
    skillName: skill.skillName,
    category: skill.category,
    score: skill.score,
    percentile: skill.percentile,
    verificationStatus: 'unverified',
    assessedAt: new Date(),
  }));

  const created = await SkillRecord.insertMany(docs, { ordered: false });

  // TODO: trigger readiness recompute when cross-module event bus is available

  await createAuditLog({
    collegeId,
    entityType: 'SkillRecord',
    entityId: data.studentId,
    entityName: `External assessment (${data.vendor})`,
    action: 'create',
    changes: [{ field: 'count', displayName: 'Skills Ingested', oldValue: null, newValue: created.length }],
    performedBy,
  });

  return { createdCount: created.length };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

/** W04-18: Update a training session status */
export async function updateTrainingSession(
  collegeId: string,
  trainingId: string,
  data: { sessionIndex: number; status: 'conducted' | 'cancelled' },
  performedBy: string,
) {
  const doc = await PlacementTraining.findOne({ _id: trainingId, collegeId });
  if (!doc) throw new AppError(404, 'Training not found');

  if (!doc.sessions || data.sessionIndex >= doc.sessions.length) {
    throw new AppError(400, 'Invalid session index');
  }

  doc.sessions[data.sessionIndex]!.status = data.status;
  doc.markModified('sessions');
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'PlacementTraining',
    entityId: String(doc._id),
    entityName: doc.title,
    action: 'update',
    changes: [{ field: `sessions[${data.sessionIndex}].status`, displayName: 'Session Status', oldValue: null, newValue: data.status }],
    performedBy,
  });

  return doc;
}

/** W04-19: Record a training assessment as a skill record */
export async function recordTrainingAssessment(
  collegeId: string,
  data: {
    trainingId: string;
    studentId: string;
    score: number;
    skillName: string;
    skillCategory: string;
  },
  performedBy: string,
) {
  // Verify training exists
  const training = await PlacementTraining.findOne({ _id: data.trainingId, collegeId });
  if (!training) throw new AppError(404, 'Training not found');

  const doc = await SkillRecord.create({
    collegeId,
    studentId: data.studentId,
    skillName: data.skillName,
    category: data.skillCategory,
    source: 'training_assessment',
    score: data.score,
    verificationStatus: 'unverified',
    assessedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'SkillRecord',
    entityId: String(doc._id),
    entityName: `${data.skillName} (training: ${training.title})`,
    action: 'create',
    changes: [{ field: 'score', displayName: 'Assessment Score', oldValue: null, newValue: data.score }],
    performedBy,
  });

  return doc;
}

/** W04-20: Get training completion stats */
export async function getTrainingCompletionStats(
  collegeId: string,
  trainingId: string,
) {
  const training = await PlacementTraining.findOne({ _id: trainingId, collegeId });
  if (!training) throw new AppError(404, 'Training not found');

  const totalSessions = training.sessions?.length ?? 0;
  const conductedSessions = training.sessions?.filter((s) => s.status === 'conducted').length ?? 0;

  const totalAttendees = await TrainingAttendance.countDocuments({ collegeId, trainingId });
  const attendedCount = await TrainingAttendance.countDocuments({ collegeId, trainingId, attended: true });

  const attendanceRate = totalAttendees > 0
    ? Math.round((attendedCount / totalAttendees) * 10000) / 100
    : 0;

  return {
    trainingId: String(training._id),
    title: training.title,
    totalSessions,
    conductedSessions,
    totalAttendees,
    attendedCount,
    attendanceRate,
  };
}

/** W04-21: Record a mock interview result as a skill record for readiness */
export async function recordMockInterviewForReadiness(
  collegeId: string,
  data: { studentId: string; placementSeasonId: string; rating: number },
  performedBy: string,
) {
  // Create a skill record from the mock interview rating (scale 1-5 -> 20-100)
  const doc = await SkillRecord.create({
    collegeId,
    studentId: data.studentId,
    skillName: 'Mock Interview',
    category: 'soft_skills',
    source: 'mock_interview',
    score: data.rating * 20,
    verificationStatus: 'unverified',
    assessedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'SkillRecord',
    entityId: String(doc._id),
    entityName: `Mock Interview (rating: ${data.rating})`,
    action: 'create',
    changes: [
      { field: 'rating', displayName: 'Rating', oldValue: null, newValue: data.rating },
      { field: 'score', displayName: 'Score', oldValue: null, newValue: data.rating * 20 },
    ],
    performedBy,
  });

  return doc;
}
