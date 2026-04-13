import { PayrollDataExtract, IPayrollDataExtract } from '../../models/hr/PayrollDataExtract';
import { AttendanceMonthlySummary } from '../../models/hr/AttendanceMonthlySummary';
import { LeaveApplication } from '../../models/hr/LeaveApplication';
import { LeaveBalance } from '../../models/hr/LeaveBalance';
import { LeaveType } from '../../models/hr/LeaveType';
import { Employee } from '../../models/hr/Employee';
import { SeparationRequest } from '../../models/hr/SeparationRequest';
import { FDPComplianceSummary } from '../../models/hr/FDPComplianceSummary';
import { Student } from '../../models/people/Student';
import { Faculty } from '../../models/people/Faculty';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../shared/audit';
import { paginate } from '../../shared/pagination';

// ===========================================================================
// Compliance Functions (W05-L2-078)
// ===========================================================================

/** Compute student-to-faculty ratio for compliance reporting */
export async function computeStudentFacultyRatio(collegeId: string) {
  const [totalStudents, totalFaculty] = await Promise.all([
    Student.countDocuments({ collegeId, status: 'active' }),
    Faculty.countDocuments({ collegeId, status: 'active' }),
  ]);

  const ratio = totalFaculty > 0 ? Math.round((totalStudents / totalFaculty) * 100) / 100 : 0;

  return {
    totalStudents,
    totalFaculty,
    ratio,
    computedAt: new Date(),
  };
}

/** Generate FDP compliance report aggregated by department */
export async function generateFDPComplianceReport(collegeId: string, academicYearId: string) {
  const summaries = await FDPComplianceSummary.find({ collegeId, academicYearId }).lean();

  // Get employee details to map faculty -> department
  const facultyIds = summaries.map((s) => s.facultyId);
  const employees = await Employee.find({ collegeId, _id: { $in: facultyIds } }).lean();
  const deptMap = new Map<string, string>();
  for (const emp of employees) {
    deptMap.set(String(emp._id), String(emp.departmentId));
  }

  // Aggregate per department
  const deptAgg: Record<string, { compliant: number; partial: number; non_compliant: number; total: number }> = {};
  for (const s of summaries) {
    const deptId = deptMap.get(String(s.facultyId)) ?? 'unknown';
    if (!deptAgg[deptId]) {
      deptAgg[deptId] = { compliant: 0, partial: 0, non_compliant: 0, total: 0 };
    }
    const bucket = deptAgg[deptId]!;
    bucket.total += 1;
    if (s.complianceStatus === 'compliant') bucket.compliant += 1;
    else if (s.complianceStatus === 'partial') bucket.partial += 1;
    else bucket.non_compliant += 1;
  }

  return {
    academicYearId,
    totalFaculty: summaries.length,
    compliant: summaries.filter((s) => s.complianceStatus === 'compliant').length,
    partial: summaries.filter((s) => s.complianceStatus === 'partial').length,
    nonCompliant: summaries.filter((s) => s.complianceStatus === 'non_compliant').length,
    byDepartment: deptAgg,
    generatedAt: new Date(),
  };
}

// ===========================================================================
// Payroll Extract Functions (W05-L2-079)
// ===========================================================================

/** Generate payroll data extract for a given month/year */
export async function generatePayrollExtract(
  collegeId: string,
  month: number,
  year: number,
  performedBy: string,
) {
  // Check for existing extract
  const existing = await PayrollDataExtract.findOne({ collegeId, month, year });
  if (existing) throw new AppError(409, `Payroll extract already exists for ${month}/${year}`);

  // Date boundaries for the month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // last day of given month

  // (a) Attendance monthly summaries
  const attendanceRecords = await AttendanceMonthlySummary.find({ collegeId, month, year }).lean();
  const attendanceSummary = attendanceRecords.map((r) => ({
    employeeId: r.employeeId,
    totalPresent: r.totalPresent,
    totalAbsent: r.totalAbsent,
    totalLate: r.totalLate,
    totalLeave: r.totalLeave,
    lopDays: r.lopDays,
  }));

  // (b) Approved leave applications overlapping the month
  const leaveApps = await LeaveApplication.find({
    collegeId,
    status: 'approved',
    fromDate: { $lte: lastDay },
    toDate: { $gte: firstDay },
  }).lean();

  // Map leaveTypeIds to names
  const leaveTypeIds = [...new Set(leaveApps.map((la) => String(la.leaveTypeId)))];
  const leaveTypes = await LeaveType.find({ collegeId, _id: { $in: leaveTypeIds } }).lean();
  const leaveTypeMap = new Map<string, string>();
  for (const lt of leaveTypes) {
    leaveTypeMap.set(String(lt._id), lt.name);
  }

  const leaveConsumed = leaveApps.map((la) => ({
    employeeId: la.employeeId,
    leaveType: leaveTypeMap.get(String(la.leaveTypeId)) ?? 'Unknown',
    daysConsumed: la.days,
  }));

  // (c) LOP days from LeaveBalance
  const leaveBalances = await LeaveBalance.find({
    collegeId,
    lopDays: { $gt: 0 },
  }).lean();
  const lopDaysMap = new Map<string, number>();
  for (const lb of leaveBalances) {
    const key = String(lb.employeeId);
    lopDaysMap.set(key, (lopDaysMap.get(key) ?? 0) + (lb.lopDays ?? 0));
  }
  const lopDays = Array.from(lopDaysMap.entries()).map(([empId, days]) => ({
    employeeId: empId as unknown as typeof attendanceSummary[0]['employeeId'],
    days,
  }));

  // (d) New joiners — employees whose joiningDate falls within the month
  const newJoinerRecords = await Employee.find({
    collegeId,
    joiningDate: { $gte: firstDay, $lte: lastDay },
  }).lean();
  const newJoiners = newJoinerRecords.map((emp) => ({
    employeeId: emp._id,
    joiningDate: emp.joiningDate,
    designation: emp.designation,
  }));

  // (e) Separations — confirmedLastWorkingDay falls within the month
  const separationRecords = await SeparationRequest.find({
    collegeId,
    confirmedLastWorkingDay: { $gte: firstDay, $lte: lastDay },
  }).lean();
  const separations = separationRecords.map((sr) => ({
    employeeId: sr.employeeId,
    lastWorkingDay: sr.confirmedLastWorkingDay!,
    separationType: sr.separationType,
  }));

  // (f) Create PayrollDataExtract
  const doc = await PayrollDataExtract.create({
    collegeId,
    month,
    year,
    attendanceSummary,
    leaveConsumed,
    lopDays,
    newJoiners,
    separations,
    status: 'draft',
  });

  // (g) Audit log
  await createAuditLog({
    collegeId,
    entityType: 'PayrollDataExtract',
    entityId: String(doc._id),
    entityName: `Payroll Extract ${month}/${year}`,
    action: 'create',
    changes: [
      { field: 'month', displayName: 'Month', oldValue: null, newValue: month },
      { field: 'year', displayName: 'Year', oldValue: null, newValue: year },
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'draft' },
    ],
    performedBy,
  });

  return doc;
}

/** Mark a payroll extract as reviewed */
export async function reviewPayrollExtract(
  collegeId: string,
  extractId: string,
  performedBy: string,
) {
  const doc = await PayrollDataExtract.findOne({ _id: extractId, collegeId });
  if (!doc) throw new AppError(404, 'Payroll extract not found');
  if (doc.status !== 'draft') throw new AppError(400, 'Only draft extracts can be reviewed');

  const oldStatus = doc.status;
  doc.status = 'reviewed';
  doc.reviewedBy = performedBy as unknown as IPayrollDataExtract['reviewedBy'];
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'PayrollDataExtract',
    entityId: String(doc._id),
    entityName: `Payroll Extract ${doc.month}/${doc.year}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'reviewed' },
      { field: 'reviewedBy', displayName: 'Reviewed By', oldValue: null, newValue: performedBy },
    ],
    performedBy,
  });

  return doc;
}

/** Release a reviewed payroll extract */
export async function releasePayrollExtract(
  collegeId: string,
  extractId: string,
  performedBy: string,
) {
  const doc = await PayrollDataExtract.findOne({ _id: extractId, collegeId });
  if (!doc) throw new AppError(404, 'Payroll extract not found');
  if (doc.status !== 'reviewed') throw new AppError(400, 'Only reviewed extracts can be released');

  const oldStatus = doc.status;
  doc.status = 'released';
  doc.releasedAt = new Date();
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'PayrollDataExtract',
    entityId: String(doc._id),
    entityName: `Payroll Extract ${doc.month}/${doc.year}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'released' },
      { field: 'releasedAt', displayName: 'Released At', oldValue: null, newValue: doc.releasedAt },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// Attendance Compliance (W05-L2-078)
// ===========================================================================

/** Generate attendance compliance report for M10 compliance module */
export async function generateAttendanceComplianceReport(
  collegeId: string,
  month: number,
  year: number,
) {
  const records = await AttendanceMonthlySummary.find({ collegeId, month, year }).lean();

  if (records.length === 0) {
    return {
      month,
      year,
      totalEmployees: 0,
      averagePresentPercent: 0,
      averageLatePercent: 0,
      averageAbsentPercent: 0,
      generatedAt: new Date(),
    };
  }

  const totals = records.reduce(
    (acc, r) => {
      const total = r.totalPresent + r.totalAbsent + r.totalLate + r.totalLeave + r.totalHoliday + r.totalHalfDay + r.totalOnDuty;
      acc.totalDays += total;
      acc.presentDays += r.totalPresent;
      acc.lateDays += r.totalLate;
      acc.absentDays += r.totalAbsent;
      return acc;
    },
    { totalDays: 0, presentDays: 0, lateDays: 0, absentDays: 0 },
  );

  const pct = (num: number, denom: number) =>
    denom > 0 ? Math.round((num / denom) * 10000) / 100 : 0;

  return {
    month,
    year,
    totalEmployees: records.length,
    averagePresentPercent: pct(totals.presentDays, totals.totalDays),
    averageLatePercent: pct(totals.lateDays, totals.totalDays),
    averageAbsentPercent: pct(totals.absentDays, totals.totalDays),
    generatedAt: new Date(),
  };
}

// ===========================================================================
// CRUD for PayrollDataExtract
// ===========================================================================

/** List payroll data extracts with pagination */
export async function listPayrollDataExtracts(
  collegeId: string,
  page: number,
  limit: number,
  filters: { status?: string; year?: number } = {},
) {
  const filter: Record<string, unknown> = { collegeId };
  if (filters.status) filter.status = filters.status;
  if (filters.year) filter.year = filters.year;
  return paginate(PayrollDataExtract, filter, page, limit);
}

/** Get a single payroll data extract by ID */
export async function getPayrollDataExtract(collegeId: string, id: string) {
  const doc = await PayrollDataExtract.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payroll data extract not found');
  return doc;
}

/** Create a payroll data extract (manual/empty) */
export async function createPayrollDataExtract(
  collegeId: string,
  data: Partial<IPayrollDataExtract>,
  performedBy: string,
) {
  const doc = await PayrollDataExtract.create({ ...data, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'PayrollDataExtract',
    entityId: String(doc._id),
    entityName: `Payroll Extract ${doc.month}/${doc.year}`,
    action: 'create',
    changes: [
      { field: 'month', displayName: 'Month', oldValue: null, newValue: doc.month },
      { field: 'year', displayName: 'Year', oldValue: null, newValue: doc.year },
      { field: 'status', displayName: 'Status', oldValue: null, newValue: doc.status },
    ],
    performedBy,
  });

  return doc;
}

/** Update a payroll data extract */
export async function updatePayrollDataExtract(
  collegeId: string,
  id: string,
  data: Partial<IPayrollDataExtract>,
  performedBy: string,
) {
  const doc = await PayrollDataExtract.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payroll data extract not found');
  if (doc.status === 'released') throw new AppError(400, 'Cannot update a released extract');

  const changes: { field: string; displayName: string; oldValue: unknown; newValue: unknown }[] = [];

  if (data.month !== undefined && data.month !== doc.month) {
    changes.push({ field: 'month', displayName: 'Month', oldValue: doc.month, newValue: data.month });
    doc.month = data.month;
  }
  if (data.year !== undefined && data.year !== doc.year) {
    changes.push({ field: 'year', displayName: 'Year', oldValue: doc.year, newValue: data.year });
    doc.year = data.year;
  }
  if (data.status !== undefined && data.status !== doc.status) {
    changes.push({ field: 'status', displayName: 'Status', oldValue: doc.status, newValue: data.status });
    doc.status = data.status;
  }

  await doc.save();

  if (changes.length > 0) {
    await createAuditLog({
      collegeId,
      entityType: 'PayrollDataExtract',
      entityId: String(doc._id),
      entityName: `Payroll Extract ${doc.month}/${doc.year}`,
      action: 'update',
      changes,
      performedBy,
    });
  }

  return doc;
}

/** Delete a payroll data extract */
export async function deletePayrollDataExtract(
  collegeId: string,
  id: string,
  performedBy: string,
) {
  const doc = await PayrollDataExtract.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payroll data extract not found');
  if (doc.status === 'released') throw new AppError(400, 'Cannot delete a released extract');

  await PayrollDataExtract.deleteOne({ _id: id, collegeId });

  await createAuditLog({
    collegeId,
    entityType: 'PayrollDataExtract',
    entityId: String(doc._id),
    entityName: `Payroll Extract ${doc.month}/${doc.year}`,
    action: 'delete',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: doc.status, newValue: null },
    ],
    performedBy,
  });

  return { success: true };
}
