import { Model, FilterQuery } from 'mongoose';
import { PaginatedResult } from './types';

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  page = 1,
  limit = 20,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
  populate?: string | string[] | Record<string, unknown>[],
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * limit;
  let query = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) query = query.populate(populate as any);
  const [items, total] = await Promise.all([
    query.lean() as Promise<T[]>,
    model.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}
