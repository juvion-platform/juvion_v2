import { describe, it, expect } from 'vitest';
import { Schema, model, Types } from 'mongoose';
import { buildSearchClause } from '../pagination';
import { getListContext, runWithListContext } from '../request-context';

const testSchema = new Schema({
  collegeId: { type: Schema.Types.ObjectId, required: true },
  name: String,
  code: String,
  status: { type: String, enum: ['active', 'inactive'] },
  capacity: Number,
  isActive: Boolean,
  password: String,
  refreshToken: String,
});
const TestModel = model('SearchTestModel', testSchema);

describe('buildSearchClause', () => {
  it('matches string fields case-insensitively', () => {
    const clause = buildSearchClause(TestModel, 'cse') as any;
    expect(clause).not.toBeNull();
    const fields = clause.$or.map((c: any) => Object.keys(c)[0]);
    expect(fields).toContain('name');
    expect(fields).toContain('code');
    expect(clause.$or[0].name).toEqual({ $regex: 'cse', $options: 'i' });
  });

  it('never searches credential-ish fields', () => {
    const clause = buildSearchClause(TestModel, 'secret') as any;
    const fields = clause.$or.map((c: any) => Object.keys(c)[0]);
    expect(fields).not.toContain('password');
    expect(fields).not.toContain('refreshToken');
  });

  it('ignores non-string fields', () => {
    const clause = buildSearchClause(TestModel, 'x') as any;
    const fields = clause.$or.map((c: any) => Object.keys(c)[0]);
    expect(fields).not.toContain('capacity');
    expect(fields).not.toContain('isActive');
  });

  it('escapes regex metacharacters so a term cannot inject a pattern', () => {
    const clause = buildSearchClause(TestModel, 'a.*b') as any;
    expect(clause.$or[0].name.$regex).toBe('a\\.\\*b');
  });

  it('matches _id exactly for an ObjectId-shaped term', () => {
    const id = new Types.ObjectId().toHexString();
    const clause = buildSearchClause(TestModel, id) as any;
    expect(clause.$or[0]._id).toBeInstanceOf(Types.ObjectId);
    expect(String(clause.$or[0]._id)).toBe(id);
  });

  it('returns null for an empty term so the filter is left untouched', () => {
    expect(buildSearchClause(TestModel, '')).toBeNull();
    expect(buildSearchClause(TestModel, '   ')).toBeNull();
  });
});

describe('list request context', () => {
  it('is empty outside a request, so jobs and tests are unaffected', () => {
    expect(getListContext()).toEqual({});
  });

  it('exposes the search term inside its scope, including across await points', async () => {
    await runWithListContext({ search: 'rama' }, async () => {
      expect(getListContext().search).toBe('rama');
      await Promise.resolve();
      // AsyncLocalStorage must survive the microtask boundary — this is the
      // whole reason paginate() can read it four layers down the call stack.
      expect(getListContext().search).toBe('rama');
    });
    expect(getListContext()).toEqual({});
  });
});
