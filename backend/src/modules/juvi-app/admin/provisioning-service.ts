import { Types } from 'mongoose';
import { JuviProvisioningRun, IJuviProvisioningRun } from '../../../models/juvi/JuviProvisioningRun';
import { JuviProvisionedCredential } from '../../../models/juvi/JuviProvisionedCredential';
import { Section } from '../../../models/academic-structure/Section';
import { Batch } from '../../../models/academic-structure/Batch';
import { Department } from '../../../models/academic-structure/Department';
import { College } from '../../../models/College';
import { paginate } from '../../../shared/pagination';
import { PaginatedResult } from '../../../shared/types';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { decryptSecret } from '../accounts/credential-store';

export async function listRuns(collegeId: string, page: number, limit: number): Promise<PaginatedResult<IJuviProvisioningRun>> {
  return paginate(JuviProvisioningRun, { collegeId }, page, limit, { createdAt: -1 });
}

export async function getRun(collegeId: string, runId: string): Promise<IJuviProvisioningRun> {
  const run = await JuviProvisioningRun.findOne({ _id: runId, collegeId });
  if (!run) throw new AppError(404, 'Provisioning run not found');
  return run;
}

export interface CredentialGroup { key: 'section' | 'batch' | 'department' | 'none'; id: string | null; label: string; count: number }

export async function credentialGroups(collegeId: string, runId: string): Promise<{ expiresAt: Date | null; live: boolean; groups: CredentialGroup[] }> {
  const run = await getRun(collegeId, runId);
  const rows = await JuviProvisionedCredential.find({ collegeId, runId: run._id, expiresAt: { $gt: new Date() } }).select('sectionId batchId departmentId').lean();
  const count = (key: 'sectionId' | 'batchId' | 'departmentId') => {
    const m = new Map<string, number>();
    for (const r of rows) { const id = r[key] ? String(r[key]) : ''; m.set(id, (m.get(id) ?? 0) + 1); }
    return m;
  };
  const groups: CredentialGroup[] = [];
  const bySection = count('sectionId');
  const sections = await Section.find({ collegeId, _id: { $in: [...bySection.keys()].filter(Boolean) } }).select('name').lean();
  for (const [id, n] of bySection) {
    if (!id) { groups.push({ key: 'none', id: null, label: 'No section', count: n }); continue; }
    groups.push({ key: 'section', id, label: `Section ${sections.find((s) => String(s._id) === id)?.name ?? '?'}`, count: n });
  }
  const byBatch = count('batchId');
  const batches = await Batch.find({ collegeId, _id: { $in: [...byBatch.keys()].filter(Boolean) } }).select('code').lean();
  for (const [id, n] of byBatch) if (id) groups.push({ key: 'batch', id, label: `Batch ${batches.find((b) => String(b._id) === id)?.code ?? '?'}`, count: n });
  const byDept = count('departmentId');
  const depts = await Department.find({ collegeId, _id: { $in: [...byDept.keys()].filter(Boolean) } }).select('name').lean();
  for (const [id, n] of byDept) if (id) groups.push({ key: 'department', id, label: depts.find((d) => String(d._id) === id)?.name ?? '?', count: n });
  return { expiresAt: run.credentialsExpireAt ?? null, live: rows.length > 0, groups };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function credentialsCsv(
  collegeId: string, runId: string, filter: { sectionId?: string; batchId?: string; departmentId?: string }, performedBy: string,
): Promise<string> {
  const run = await getRun(collegeId, runId);
  const q: Record<string, unknown> = { collegeId, runId: run._id, expiresAt: { $gt: new Date() } };
  if (filter.sectionId) q.sectionId = new Types.ObjectId(filter.sectionId);
  if (filter.batchId) q.batchId = new Types.ObjectId(filter.batchId);
  if (filter.departmentId) q.departmentId = new Types.ObjectId(filter.departmentId);
  const rows = await JuviProvisionedCredential.find(q).sort({ identifier: 1 }).lean();
  if (rows.length === 0) throw new AppError(410, 'The credentials for this run have expired or none match. Reset passwords from the accounts table instead.');

  const [college, sections] = await Promise.all([
    College.findById(collegeId).select('code').lean(),
    Section.find({ collegeId, _id: { $in: rows.map((r) => r.sectionId).filter(Boolean) } }).select('name').lean(),
  ]);
  const sectionName = new Map(sections.map((s) => [String(s._id), s.name]));
  const lines = ['identifier,name,section,temporaryPassword,institutionCode'];
  for (const r of rows) {
    lines.push([r.identifier, r.displayName, r.sectionId ? sectionName.get(String(r.sectionId)) ?? '' : '', decryptSecret(r), college?.code ?? ''].map(csvCell).join(','));
  }
  await createAuditLog({
    collegeId, entityType: 'JuviProvisioningRun', entityId: String(run._id), entityName: `Provisioning run ${String(run._id).slice(-6)}`,
    action: 'update', changes: [{ field: 'credentialsExported', displayName: 'Credentials exported', oldValue: null, newValue: { count: rows.length, ...filter } }], performedBy,
  });
  return lines.join('\n') + '\n';
}
