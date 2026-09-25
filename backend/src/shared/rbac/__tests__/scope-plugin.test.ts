import { describe, it, expect, vi } from 'vitest';
import mongoose, { Schema } from 'mongoose';
import { axisFor, narrowByIdFilter } from '../scope-plugin';
import { applyAuthScope } from '../apply-scope';
import type { AuthScope } from '../types';

/** 010 — the by-id backstop narrows un-scoped `findOne({ _id })` calls on scoped requests. */
const hod: AuthScope = { departmentOnly: true, departmentId: 'd1', branchIds: ['b1'], selfOnly: false, userId: 'u', resolvedPermissions: [] };
const fake = (modelName: string, schema: Schema) => ({ modelName, schema } as any);

describe('axisFor', () => {
  it('knows the people models, department, and member-linked collections', () => {
    expect(axisFor('Student', new Schema({}))).toMatchObject({ kind: 'direct' });
    expect(axisFor('Department', new Schema({}))).toMatchObject({ kind: 'direct', opts: { departmentField: '_id' } });
    expect(axisFor('Attendance', new Schema({ studentId: Schema.Types.ObjectId }))).toMatchObject({ kind: 'via', member: 'Student', field: 'studentId' });
    expect(axisFor('Payroll', new Schema({ employeeId: Schema.Types.ObjectId }))).toMatchObject({ kind: 'via', member: 'Employee' });
    expect(axisFor('Employee', new Schema({ employeeId: String }))).toMatchObject({ kind: 'direct' }); // the code string is not a link
    expect(axisFor('ExamRoom', new Schema({ name: String }))).toBeNull();
  });
});

describe('narrowByIdFilter', () => {
  it('narrows a Student by-id read to the department branches', async () => {
    const filter: Record<string, unknown> = { _id: 's1', collegeId: 'c1' };
    await narrowByIdFilter(fake('Student', new Schema({})), filter, hod);
    expect(filter.branchId).toEqual({ $in: ['b1'] });
  });
  it('leaves filters that already went through applyAuthScope, lists, and axis-less models alone', async () => {
    const scoped: Record<string, unknown> = { _id: 's1', collegeId: 'c1' };
    applyAuthScope(scoped, { ...hod, departmentOnly: false });
    await narrowByIdFilter(fake('Student', new Schema({})), scoped, hod);
    expect(scoped.branchId).toBeUndefined();
    const list: Record<string, unknown> = { collegeId: 'c1' };
    await narrowByIdFilter(fake('Student', new Schema({})), list, hod);
    expect(list).toEqual({ collegeId: 'c1' });
    const room: Record<string, unknown> = { _id: 'r1', collegeId: 'c1' };
    await narrowByIdFilter(fake('ExamRoom', new Schema({ name: String })), room, hod);
    expect(room).toEqual({ _id: 'r1', collegeId: 'c1' });
  });
  it('resolves member ids for a linked collection and never widens a caller restriction', async () => {
    const spy = vi.spyOn(mongoose, 'model').mockReturnValue({ find: () => ({ select: () => ({ lean: async () => [{ _id: 'e1' }, { _id: 'e2' }] }) }) } as any);
    const pay: Record<string, unknown> = { _id: 'p1', collegeId: 'c1' };
    await narrowByIdFilter(fake('Payroll', new Schema({ employeeId: Schema.Types.ObjectId })), pay, hod);
    expect(pay.employeeId).toEqual({ $in: ['e1', 'e2'] });
    const own: Record<string, unknown> = { _id: 'p1', collegeId: 'c1', employeeId: 'e9' };
    await narrowByIdFilter(fake('Payroll', new Schema({ employeeId: Schema.Types.ObjectId })), own, hod);
    expect(own.employeeId).toBe('e9');
    expect(own.$and).toEqual([{ employeeId: { $in: ['e1', 'e2'] } }]);
    spy.mockRestore();
  });
});
