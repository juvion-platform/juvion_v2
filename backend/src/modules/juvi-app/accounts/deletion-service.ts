import { FilterQuery, Model } from 'mongoose';

/**
 * Tenancy-guarded `deleteMany` for the Juvi account-deletion path (011 §5).
 *
 * The 010 scope-plugin hooks `findOne`/`updateOne`/`deleteOne`/… but **not**
 * `deleteMany` (`shared/rbac/scope-plugin.ts:73`), and it is inert on the mobile
 * stack anyway (it reads `req.authScope`, which the mobile routes never set).
 * Nothing else enforces `collegeId` on these writes, so every delete in this
 * module goes through here rather than calling `deleteMany` directly.
 */
export async function deleteScoped<T>(model: Model<T>, filter: Record<string, unknown>) {
  if (!filter.collegeId) throw new Error('deleteScoped requires collegeId');
  return model.deleteMany(filter as FilterQuery<T>);
}
