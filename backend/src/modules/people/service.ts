import mongoose from 'mongoose';
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { Parent } from '../../models/people/Parent';
import { Organization } from '../../models/people/Organization';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import {
  getFacultyProfileCompleteness,
  getOrganizationProfileCompleteness,
  getParentProfileCompleteness,
  getStaffProfileCompleteness,
  getStudentOnboardingCompleteness,
  getStudentProfileCompleteness,
} from './profileCompleteness';

const toOid = (id: string) => new mongoose.Types.ObjectId(id);

// ─── Dashboard Stats ─────────────────────────────────
export async function getDashboardStats(collegeId: string) {
  const [persons, students, activeStudents, faculty, activeFaculty, staff, activeStaff, parents, organizations] = await Promise.all([
    Person.countDocuments({ collegeId }),
    Student.countDocuments({ collegeId }),
    Student.countDocuments({ collegeId, status: 'active' }),
    Faculty.countDocuments({ collegeId }),
    Faculty.countDocuments({ collegeId, status: 'active' }),
    Staff.countDocuments({ collegeId }),
    Staff.countDocuments({ collegeId, status: 'active' }),
    Parent.countDocuments({ collegeId }),
    Organization.countDocuments({ collegeId }),
  ]);
  return { persons, students, activeStudents, faculty, activeFaculty, staff, activeStaff, parents, organizations };
}

// ─── Helpers ─────────────────────────────────────────

/** Create a Person record, return the document */
async function createPersonRecord(collegeId: string, data: any) {
  const personFields: any = {
    collegeId,
    name: data.name,
    phone: data.phone,
  };
  ['email', 'aadhaar', 'dob', 'gender', 'alternatePhone', 'preferredLanguage', 'address', 'emergencyContact', 'photo', 'biometricEnrolled'].forEach(k => {
    if (data[k] !== undefined) personFields[k] = data[k];
  });
  return Person.create(personFields);
}

function buildStudentOnboardingFields(data: any) {
  const fields: any = {};
  if (data.onboardingStatus !== undefined) fields.onboardingStatus = data.onboardingStatus;
  if (data.onboardingChecklist !== undefined) fields.onboardingChecklist = data.onboardingChecklist;
  if (data.onboardingCompletedAt !== undefined) {
    fields.onboardingCompletedAt = data.onboardingCompletedAt ? new Date(data.onboardingCompletedAt) : undefined;
  } else if (data.onboardingStatus === 'completed') {
    fields.onboardingCompletedAt = new Date();
  }
  if (data.onboardingStatus && data.onboardingStatus !== 'completed' && data.onboardingCompletedAt === undefined) {
    fields.onboardingCompletedAt = undefined;
  }
  return fields;
}

async function syncStudentParentLinks(collegeId: string, studentId: string, previousParentIds: string[], nextParentIds: string[]) {
  const previous = new Set(previousParentIds.filter(Boolean));
  const next = new Set(nextParentIds.filter(Boolean));
  const toRemove = [...previous].filter(id => !next.has(id));
  const toAdd = [...next].filter(id => !previous.has(id));

  if (toRemove.length > 0) {
    await Parent.updateMany(
      { collegeId, _id: { $in: toRemove } },
      { $pull: { linkedStudents: toOid(studentId) } },
    );
  }
  if (toAdd.length > 0) {
    await Parent.updateMany(
      { collegeId, _id: { $in: toAdd } },
      { $addToSet: { linkedStudents: toOid(studentId) } },
    );
  }
}

// ─── Persons (raw) ───────────────────────────────────

export async function listPersons(collegeId: string, page: number, limit: number, search?: string) {
  const match: any = { collegeId: toOid(collegeId) };
  if (search) match.name = { $regex: search, $options: 'i' };
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: match },
    { $lookup: { from: 'students', localField: '_id', foreignField: 'personId', as: '_students', pipeline: [{ $project: { _id: 1 } }] } },
    { $lookup: { from: 'faculties', localField: '_id', foreignField: 'personId', as: '_faculty', pipeline: [{ $project: { _id: 1 } }] } },
    { $lookup: { from: 'staffs', localField: '_id', foreignField: 'personId', as: '_staff', pipeline: [{ $project: { _id: 1 } }] } },
    { $lookup: { from: 'parents', localField: '_id', foreignField: 'personId', as: '_parents', pipeline: [{ $project: { _id: 1 } }] } },
    { $addFields: {
      roles: {
        $filter: {
          input: [
            { $cond: [{ $gt: [{ $size: '$_students' }, 0] }, { type: 'Student', recordId: { $arrayElemAt: ['$_students._id', 0] } }, null] },
            { $cond: [{ $gt: [{ $size: '$_faculty' }, 0] }, { type: 'Faculty', recordId: { $arrayElemAt: ['$_faculty._id', 0] } }, null] },
            { $cond: [{ $gt: [{ $size: '$_staff' }, 0] }, { type: 'Staff', recordId: { $arrayElemAt: ['$_staff._id', 0] } }, null] },
            { $cond: [{ $gt: [{ $size: '$_parents' }, 0] }, { type: 'Parent', recordId: { $arrayElemAt: ['$_parents._id', 0] } }, null] },
          ],
          cond: { $ne: ['$$this', null] },
        },
      },
    }},
    { $project: { _students: 0, _faculty: 0, _staff: 0, _parents: 0 } },
  ];

  const [items, countResult] = await Promise.all([
    Person.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Person.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export async function getPerson(collegeId: string, id: string) {
  const doc = await Person.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Person not found');
  return doc;
}

export async function createPerson(collegeId: string, data: any, performedBy: string) {
  const doc = await Person.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Person', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updatePerson(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Person.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Person not found');
  await createAuditLog({ collegeId, entityType: 'Person', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deletePerson(collegeId: string, id: string, performedBy: string) {
  const doc = await Person.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Person not found');
  await createAuditLog({ collegeId, entityType: 'Person', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Students ────────────────────────────────────────

export async function listStudents(collegeId: string, page: number, limit: number, status?: string, search?: string) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
    { $lookup: { from: 'regulations', localField: 'regulationId', foreignField: '_id', as: 'regulation' } },
    { $unwind: { path: '$regulation', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'programmes', localField: 'programmeId', foreignField: '_id', as: 'programme' } },
    { $unwind: { path: '$programme', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'branches', localField: 'branchId', foreignField: '_id', as: 'branch' } },
    { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'batches', localField: 'batchId', foreignField: '_id', as: 'batch' } },
    { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'parents', localField: 'primaryParentId', foreignField: '_id', as: 'primaryParent' } },
    { $unwind: { path: '$primaryParent', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'people', localField: 'primaryParent.personId', foreignField: '_id', as: 'primaryParentPerson' } },
    { $unwind: { path: '$primaryParentPerson', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'parents', localField: 'feeResponsibleParentId', foreignField: '_id', as: 'feeResponsibleParent' } },
    { $unwind: { path: '$feeResponsibleParent', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'people', localField: 'feeResponsibleParent.personId', foreignField: '_id', as: 'feeResponsibleParentPerson' } },
    { $unwind: { path: '$feeResponsibleParentPerson', preserveNullAndEmptyArrays: true } },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Student.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Student.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({
      ...item,
      profileCompleteness: getStudentProfileCompleteness(item),
      onboardingCompleteness: getStudentOnboardingCompleteness(item),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getStudent(collegeId: string, id: string): Promise<any> {
  const doc = await Student.findOne({ _id: id, collegeId })
    .populate('personId')
    .populate('regulationId')
    .populate('programmeId')
    .populate('branchId')
    .populate('batchId')
    .populate({ path: 'primaryParentId', populate: { path: 'personId' } })
    .populate({ path: 'feeResponsibleParentId', populate: { path: 'personId' } })
    .lean();
  if (!doc) throw new AppError(404, 'Student not found');
  return {
    ...doc,
    profileCompleteness: getStudentProfileCompleteness(doc),
    onboardingCompleteness: getStudentOnboardingCompleteness(doc),
  };
}

export async function createStudent(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const studentFields: any = {
    collegeId,
    personId: person._id,
    admissionYear: data.admissionYear,
    status: data.status || 'active',
    onboardingStatus: data.onboardingStatus || 'not_started',
  };
  ['category', 'quota', 'rollNumber', 'regulationId', 'programmeId', 'branchId', 'batchId', 'primaryParentId', 'feeResponsibleParentId'].forEach(k => { if (data[k]) studentFields[k] = data[k]; });
  Object.assign(studentFields, buildStudentOnboardingFields(data));
  const doc = await Student.create(studentFields);
  await syncStudentParentLinks(
    collegeId,
    String(doc._id),
    [],
    [data.primaryParentId, data.feeResponsibleParentId].filter(Boolean),
  );
  await createAuditLog({ collegeId, entityType: 'Student', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function updateStudent(collegeId: string, id: string, data: any, performedBy: string): Promise<any> {
  const student = await Student.findOne({ _id: id, collegeId });
  if (!student) throw new AppError(404, 'Student not found');
  const previousPrimaryParentId = student.primaryParentId ? String(student.primaryParentId) : '';
  const previousFeeResponsibleParentId = student.feeResponsibleParentId ? String(student.feeResponsibleParentId) : '';
  const previousParentIds = [previousPrimaryParentId, previousFeeResponsibleParentId].filter(Boolean);

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'photo', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(student.personId, { $set: personFields });

  const studentFields: any = {};
  ['admissionYear', 'category', 'quota', 'rollNumber', 'status', 'regulationId', 'programmeId', 'branchId', 'batchId', 'primaryParentId', 'feeResponsibleParentId'].forEach(k => { if (data[k] !== undefined) studentFields[k] = data[k]; });
  Object.assign(studentFields, buildStudentOnboardingFields(data));
  if (Object.keys(studentFields).length > 0) await Student.findByIdAndUpdate(id, { $set: studentFields });
  const nextParentIds = [
    data.primaryParentId !== undefined ? data.primaryParentId : previousPrimaryParentId,
    data.feeResponsibleParentId !== undefined ? data.feeResponsibleParentId : previousFeeResponsibleParentId,
  ].filter(Boolean);
  await syncStudentParentLinks(collegeId, id, previousParentIds, nextParentIds);

  await createAuditLog({ collegeId, entityType: 'Student', entityId: id, entityName: data.name || 'Student', action: 'update', changes: [], performedBy });
  return getStudent(collegeId, id);
}

export async function deleteStudent(collegeId: string, id: string, performedBy: string) {
  const doc = await Student.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Student not found');
  await createAuditLog({ collegeId, entityType: 'Student', entityId: id, entityName: 'Student', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Faculty ─────────────────────────────────────────

export async function listFaculty(collegeId: string, page: number, limit: number, status?: string, search?: string) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
    { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Faculty.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Faculty.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({ ...item, profileCompleteness: getFacultyProfileCompleteness(item) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getFaculty(collegeId: string, id: string): Promise<any> {
  const doc = await Faculty.findOne({ _id: id, collegeId }).populate('personId').populate('departmentId').lean();
  if (!doc) throw new AppError(404, 'Faculty not found');
  return { ...doc, profileCompleteness: getFacultyProfileCompleteness(doc) };
}

export async function createFaculty(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const fields: any = {
    collegeId, personId: person._id,
    employeeCode: data.employeeCode, designation: data.designation,
    contractType: data.contractType || 'regular', status: data.status || 'active',
  };
  ['specialization', 'qualification', 'departmentId'].forEach(k => { if (data[k]) fields[k] = data[k]; });
  const doc = await Faculty.create(fields);
  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function updateFaculty(collegeId: string, id: string, data: any, performedBy: string) {
  const fac = await Faculty.findOne({ _id: id, collegeId });
  if (!fac) throw new AppError(404, 'Faculty not found');

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'photo', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(fac.personId, { $set: personFields });

  const facFields: any = {};
  ['employeeCode', 'designation', 'specialization', 'qualification', 'contractType', 'status', 'departmentId'].forEach(k => { if (data[k] !== undefined) facFields[k] = data[k]; });
  if (Object.keys(facFields).length > 0) await Faculty.findByIdAndUpdate(id, { $set: facFields });

  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: id, entityName: data.name || 'Faculty', action: 'update', changes: [], performedBy });
  const doc = await Faculty.findById(id).populate('personId').populate('departmentId').lean();
  return doc;
}

export async function deleteFaculty(collegeId: string, id: string, performedBy: string) {
  const doc = await Faculty.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Faculty not found');
  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: id, entityName: 'Faculty', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Staff ───────────────────────────────────────────

export async function listStaff(collegeId: string, page: number, limit: number, status?: string, search?: string) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
    { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Staff.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Staff.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({ ...item, profileCompleteness: getStaffProfileCompleteness(item) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getStaff(collegeId: string, id: string): Promise<any> {
  const doc = await Staff.findOne({ _id: id, collegeId }).populate('personId').populate('departmentId').lean();
  if (!doc) throw new AppError(404, 'Staff not found');
  return { ...doc, profileCompleteness: getStaffProfileCompleteness(doc) };
}

export async function createStaff(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const fields: any = {
    collegeId, personId: person._id,
    employeeCode: data.employeeCode, designation: data.designation,
    staffType: data.staffType, status: data.status || 'active',
  };
  if (data.departmentId) fields.departmentId = data.departmentId;
  const doc = await Staff.create(fields);
  await createAuditLog({ collegeId, entityType: 'Staff', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function updateStaff(collegeId: string, id: string, data: any, performedBy: string) {
  const s = await Staff.findOne({ _id: id, collegeId });
  if (!s) throw new AppError(404, 'Staff not found');

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'photo', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(s.personId, { $set: personFields });

  const staffFields: any = {};
  ['employeeCode', 'designation', 'staffType', 'status', 'departmentId'].forEach(k => { if (data[k] !== undefined) staffFields[k] = data[k]; });
  if (Object.keys(staffFields).length > 0) await Staff.findByIdAndUpdate(id, { $set: staffFields });

  await createAuditLog({ collegeId, entityType: 'Staff', entityId: id, entityName: data.name || 'Staff', action: 'update', changes: [], performedBy });
  const doc = await Staff.findById(id).populate('personId').populate('departmentId').lean();
  return doc;
}

export async function deleteStaff(collegeId: string, id: string, performedBy: string) {
  const doc = await Staff.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Staff not found');
  await createAuditLog({ collegeId, entityType: 'Staff', entityId: id, entityName: 'Staff', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Parents ─────────────────────────────────────────

export async function listParents(collegeId: string, page: number, limit: number, search?: string) {
  const filter: any = { collegeId: toOid(collegeId) };
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Parent.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Parent.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({ ...item, profileCompleteness: getParentProfileCompleteness(item) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function createParent(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const doc = await Parent.create({
    collegeId, personId: person._id,
    relationship: data.relationship,
    linkedStudents: data.linkedStudents || [],
    primaryContact: data.primaryContact || false,
    occupation: data.occupation,
    employer: data.employer,
    annualIncomeBand: data.annualIncomeBand,
    isFeeResponsible: data.isFeeResponsible || false,
    communicationPreference: data.communicationPreference,
  });
  await createAuditLog({ collegeId, entityType: 'Parent', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function getParent(collegeId: string, id: string): Promise<any> {
  const doc = await Parent.findOne({ _id: id, collegeId }).populate('personId').populate({
    path: 'linkedStudents',
    populate: { path: 'personId' },
  }).lean();
  if (!doc) throw new AppError(404, 'Parent not found');
  return { ...doc, profileCompleteness: getParentProfileCompleteness(doc) };
}

export async function updateParent(collegeId: string, id: string, data: any, performedBy: string): Promise<any> {
  const parent = await Parent.findOne({ _id: id, collegeId });
  if (!parent) throw new AppError(404, 'Parent not found');

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'photo', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(parent.personId, { $set: personFields });

  const parentFields: any = {};
  ['relationship', 'linkedStudents', 'primaryContact', 'occupation', 'employer', 'annualIncomeBand', 'isFeeResponsible', 'communicationPreference'].forEach(k => { if (data[k] !== undefined) parentFields[k] = data[k]; });
  if (Object.keys(parentFields).length > 0) await Parent.findByIdAndUpdate(id, { $set: parentFields });

  await createAuditLog({ collegeId, entityType: 'Parent', entityId: id, entityName: data.name || 'Parent', action: 'update', changes: [], performedBy });
  return getParent(collegeId, id);
}

export async function deleteParent(collegeId: string, id: string, performedBy: string) {
  const doc = await Parent.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Parent not found');
  await createAuditLog({ collegeId, entityType: 'Parent', entityId: id, entityName: 'Parent', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Organizations ───────────────────────────────────

export async function listOrganizations(collegeId: string, page: number, limit: number, search?: string) {
  const filter: any = { collegeId };
  if (search) filter.name = { $regex: search, $options: 'i' };
  const result = await paginate(Organization, filter, page, limit, { createdAt: -1 });
  return {
    ...result,
    items: result.items.map(item => ({ ...item, profileCompleteness: getOrganizationProfileCompleteness(item) })),
  };
}

export async function createOrganization(collegeId: string, data: any, performedBy: string) {
  const doc = await Organization.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Organization', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function getOrganization(collegeId: string, id: string): Promise<any> {
  const doc = await Organization.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Organization not found');
  return { ...doc, profileCompleteness: getOrganizationProfileCompleteness(doc) };
}

export async function updateOrganization(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Organization.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Organization not found');
  await createAuditLog({ collegeId, entityType: 'Organization', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteOrganization(collegeId: string, id: string, performedBy: string) {
  const doc = await Organization.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Organization not found');
  await createAuditLog({ collegeId, entityType: 'Organization', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}
