import { College } from '../../models/College';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

export async function getStats() {
  const [total, active, inactive, suspended, byPlan] = await Promise.all([
    College.countDocuments(),
    College.countDocuments({ status: 'active' }),
    College.countDocuments({ status: 'inactive' }),
    College.countDocuments({ status: 'suspended' }),
    College.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
    ]),
  ]);
  const plans: Record<string, number> = {};
  for (const p of byPlan) plans[p._id] = p.count;
  return { total, active, inactive, suspended, plans };
}

export async function listColleges(page: number, limit: number, search?: string, status?: string) {
  const filter: Record<string, any> = {};
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ name: regex }, { code: regex }];
  }
  if (status) filter.status = status;
  return paginate(College, filter, page, limit);
}

export async function getCollege(id: string) {
  const doc = await College.findById(id).lean();
  if (!doc) throw new AppError(404, 'College not found');
  return doc;
}

export async function createCollege(data: any, who: string) {
  data.code = data.code.toUpperCase();
  const doc = await College.create(data);
  await createAuditLog({
    collegeId: String(doc._id),
    entityType: 'College',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'create',
    changes: [{ field: 'college', displayName: 'College', oldValue: null, newValue: doc.name }],
    performedBy: who,
  });
  return doc;
}

export async function updateCollege(id: string, data: any, who: string) {
  const doc = await College.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
  if (!doc) throw new AppError(404, 'College not found');
  await createAuditLog({
    collegeId: String(doc._id),
    entityType: 'College',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'update',
    changes: Object.keys(data).map(k => ({ field: k, displayName: k, oldValue: null, newValue: (data as any)[k] })),
    performedBy: who,
  });
  return doc;
}

export async function deleteCollege(id: string, who: string) {
  const doc = await College.findByIdAndDelete(id).lean();
  if (!doc) throw new AppError(404, 'College not found');
  await createAuditLog({
    collegeId: String(doc._id),
    entityType: 'College',
    entityId: String(doc._id),
    entityName: doc.name,
    action: 'delete',
    changes: [{ field: 'college', displayName: 'College', oldValue: doc.name, newValue: null }],
    performedBy: who,
  });
  return { message: 'College deleted', id };
}
