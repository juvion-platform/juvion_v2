import { Model, FilterQuery } from 'mongoose';
import { PaginatedResult } from './types';

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  page = 1,
  limit = 20,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limit).lean() as Promise<T[]>,
    model.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}
