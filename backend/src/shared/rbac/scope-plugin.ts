/**
 * 010 — by-id backstop for row scope.
 *
 * Lists go through `paginate()`, which refuses an un-scoped filter on a scoped
 * request. Single-record reads, updates and deletes are spread over hundreds
 * of `Model.findOne({ _id, collegeId })` calls, so instead of editing each one
 * this global Mongoose plugin narrows any by-id query on a scoped request whose
 * filter did not go through `applyAuthScope`, using the model's own axis:
 *
 *   Student                     → branch of the department / own person / assigned
 *   Faculty, Staff, Employee    → departmentId / own person
 *   Department                  → its own _id
 *   anything with studentId     → students the caller may see
 *   anything with facultyId     → faculty in the caller's department
 *   anything with employeeId    → employees in the caller's department
 *   everything else             → untouched (college-wide, like scopeNotApplicable)
 *
 * It only ever narrows; a request with no scope in context is left alone.
 * Explicit `findOneScoped` calls stay explicit — the plugin skips marked filters.
 */
import mongoose, { Model, Schema } from 'mongoose';
import { getListContext } from '../request-context';
import { applyAuthScope, isScopeApplied, ScopeFieldOptions } from './apply-scope';
import type { AuthScope } from './types';

type Axis =
  | { kind: 'direct'; opts: ScopeFieldOptions }
  | { kind: 'via'; member: string; field: string; memberDept: 'branchId' | 'departmentId' };

const DIRECT: Record<string, ScopeFieldOptions> = {
  Student: { departmentField: 'branchId', selfField: 'personId' },
  Faculty: { departmentField: 'departmentId', selfField: 'personId' },
  Staff: { departmentField: 'departmentId', selfField: 'personId' },
  Employee: { departmentField: 'departmentId', selfField: 'personId' },
  Department: { departmentField: '_id' },
};

export function axisFor(modelName: string, schema: Schema): Axis | null {
  const direct = DIRECT[modelName];
  if (direct) return { kind: 'direct', opts: direct };
  if (schema.path('studentId')) return { kind: 'via', member: 'Student', field: 'studentId', memberDept: 'branchId' };
  if (schema.path('facultyId')) return { kind: 'via', member: 'Faculty', field: 'facultyId', memberDept: 'departmentId' };
  if (schema.path('employeeId') && schema.path('employeeId').instance === 'ObjectId') {
    return { kind: 'via', member: 'Employee', field: 'employeeId', memberDept: 'departmentId' };
  }
  return null;
}

/** Ids of members the caller may see, resolved once per request per member model. */
async function viaIds(authScope: AuthScope, collegeId: unknown, member: string, memberDept: 'branchId' | 'departmentId'): Promise<string[]> {
  const ctx = getListContext();
  ctx.viaIds ??= {};
  if (ctx.viaIds[member]) return ctx.viaIds[member]!;
  const filter: Record<string, unknown> = collegeId ? { collegeId } : {};
  applyAuthScope(filter, authScope, { selfField: 'personId', departmentField: memberDept });
  const rows = await mongoose.model(member).find(filter).select('_id').lean();
  return (ctx.viaIds[member] = rows.map((r: any) => String(r._id)));
}

/** Pure part, exported for tests: narrows `filter` in place for a by-id query on `model`. */
export async function narrowByIdFilter(model: Model<any>, filter: Record<string, unknown>, authScope: AuthScope): Promise<void> {
  if (isScopeApplied(filter) || !('_id' in filter)) return;
  const axis = axisFor(model.modelName, model.schema);
  if (!axis) return;
  if (axis.kind === 'direct') { applyAuthScope(filter, authScope, axis.opts); return; }
  const ids = await viaIds(authScope, filter.collegeId, axis.member, axis.memberDept);
  const own = filter[axis.field];
  filter[axis.field] = own === undefined ? { $in: ids } : own; // never widen a caller's own restriction
  if (own !== undefined) filter.$and = [...((filter.$and as unknown[]) ?? []), { [axis.field]: { $in: ids } }];
  applyAuthScope(filter, { ...authScope, departmentOnly: false, selfOnly: false, assignedVia: undefined }); // marks it
}

const HOOKS = ['findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'updateOne', 'deleteOne', 'replaceOne'] as const;

export function scopePlugin(schema: Schema): void {
  schema.pre(HOOKS as unknown as any, async function (this: mongoose.Query<any, any>) {
    const authScope = getListContext().authScope;
    if (!authScope) return;
    await narrowByIdFilter(this.model, this.getFilter() as Record<string, unknown>, authScope);
  });
}

mongoose.plugin(scopePlugin);
