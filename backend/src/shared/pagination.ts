import { Model, FilterQuery, Types } from 'mongoose';
import { PaginatedResult } from './types';
import { getListContext } from './request-context';

/** Never match a user's free-text search against these, whatever the schema says. */
const SEARCH_FIELD_DENYLIST = new Set([
  'password', 'passwordHash', 'hash', 'salt', 'token', 'refreshToken',
  'resetToken', 'secret', 'apiKey', 'otp', 'signature',
]);

/** Regex-scanning many fields is expensive; cap the fan-out. */
const MAX_SEARCH_FIELDS = 12;

const searchFieldCache = new WeakMap<Model<any>, string[]>();

/**
 * String paths on the schema that are worth matching a search term against.
 * Derived once per model and memoised.
 */
function searchableFields(model: Model<any>): string[] {
  const cached = searchFieldCache.get(model);
  if (cached) return cached;

  const fields: string[] = [];
  model.schema.eachPath((path, type) => {
    if (fields.length >= MAX_SEARCH_FIELDS) return;
    if (path.startsWith('_') || path === '__v') return;
    if ((type as { instance?: string }).instance !== 'String') return;
    const leaf = path.split('.').pop() ?? path;
    if (SEARCH_FIELD_DENYLIST.has(leaf)) return;
    fields.push(path);
  });

  searchFieldCache.set(model, fields);
  return fields;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the `$or` clause for a free-text search term. An id-shaped term also
 * matches `_id` exactly, so pasting an ObjectId finds the record directly.
 */
export function buildSearchClause<T>(model: Model<T>, search: string): FilterQuery<T> | null {
  const term = search.trim();
  if (!term) return null;

  const or: Record<string, unknown>[] = [];
  if (Types.ObjectId.isValid(term) && term.length === 24) {
    or.push({ _id: new Types.ObjectId(term) });
  }
  const rx = { $regex: escapeRegex(term), $options: 'i' };
  for (const field of searchableFields(model as Model<any>)) {
    or.push({ [field]: rx });
  }
  return or.length ? ({ $or: or } as FilterQuery<T>) : null;
}

export interface PaginateOptions {
  /**
   * Free-text term. Defaults to the current request's `?search=` (see
   * shared/request-context.ts), so every list endpoint supports search
   * without its controller or service having to opt in.
   * Pass `''` to explicitly disable.
   */
  search?: string;
}

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  page = 1,
  limit = 20,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
  populate?: string | string[] | Record<string, unknown>[],
  options: PaginateOptions = {},
): Promise<PaginatedResult<T>> {
  const search = options.search ?? getListContext().search;

  let effectiveFilter = filter;
  if (search) {
    const clause = buildSearchClause(model, search);
    // $and keeps the tenancy/scope filter intact — a search must never widen
    // the result set beyond what the caller was already allowed to see.
    if (clause) effectiveFilter = { $and: [filter, clause] } as FilterQuery<T>;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  let query = model.find(effectiveFilter).sort(sort).skip(skip).limit(safeLimit);
  if (populate) query = query.populate(populate as any);
  const [items, total] = await Promise.all([
    query.lean() as Promise<T[]>,
    model.countDocuments(effectiveFilter),
  ]);
  return { items, total, page: safePage, pages: Math.ceil(total / safeLimit) };
}
