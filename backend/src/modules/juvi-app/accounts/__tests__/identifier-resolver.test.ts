import { describe, it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({
  User: { findOne: vi.fn() }, Student: { findOne: vi.fn() }, Faculty: { findOne: vi.fn() }, Staff: { findOne: vi.fn() },
}));
vi.mock('../../../../models/User', () => ({ User: m.User }));
vi.mock('../../../../models/people/Student', () => ({ Student: m.Student }));
vi.mock('../../../../models/people/Faculty', () => ({ Faculty: m.Faculty }));
vi.mock('../../../../models/people/Staff', () => ({ Staff: m.Staff }));
import { resolveIdentifierToUser } from '../identifier-resolver';

const lean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });
beforeEach(() => { vi.clearAllMocks(); for (const k of Object.values(m)) k.findOne.mockReturnValue(lean(null)); });

describe('resolveIdentifierToUser', () => {
  it('treats anything with @ as an email and scopes by college', async () => {
    m.User.findOne.mockResolvedValue({ _id: 'u1' });
    const u = await resolveIdentifierToUser('c1', ' A@B.com ');
    expect(u).toEqual({ _id: 'u1' });
    expect(m.User.findOne).toHaveBeenCalledWith({ collegeId: 'c1', email: 'a@b.com' });
    expect(m.Student.findOne).not.toHaveBeenCalled();
  });

  it('resolves a roll number through Student → personId → User', async () => {
    m.Student.findOne.mockReturnValue(lean({ personId: 'p1' }));
    m.User.findOne.mockResolvedValue({ _id: 'u2' });
    expect(await resolveIdentifierToUser('c1', '21cs1042')).toEqual({ _id: 'u2' });
    expect(m.Student.findOne).toHaveBeenCalledWith({ collegeId: 'c1', rollNumber: { $in: ['21cs1042', '21CS1042'] } });
    expect(m.User.findOne).toHaveBeenCalledWith({ collegeId: 'c1', personId: 'p1' });
  });

  it('falls through Faculty then Staff employee codes', async () => {
    m.Faculty.findOne.mockReturnValue(lean(null));
    m.Staff.findOne.mockReturnValue(lean({ personId: 'p3' }));
    m.User.findOne.mockResolvedValue({ _id: 'u3' });
    expect(await resolveIdentifierToUser('c1', 'ST009')).toEqual({ _id: 'u3' });
    expect(m.Faculty.findOne).toHaveBeenCalledWith({ collegeId: 'c1', employeeCode: { $in: ['ST009', 'ST009'] } });
  });

  it('returns null when nothing matches', async () => {
    expect(await resolveIdentifierToUser('c1', 'nobody')).toBeNull();
  });
});
