import redis from '../../config/redis';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { Student } from '../../models/people/Student';
import { User } from '../../models/User';
import { Branch } from '../../models/academic-structure/Branch';

const SCOPE_CACHE_TTL = 900; // 15 minutes

interface UserScopeData {
  departmentId?: string;
  branchIds?: string[];
  personId?: string;
  studentId?: string;
}

function cacheKey(userId: string): string {
  return `user:scope:${userId}`;
}

/**
 * Resolve a user's departmentId, personId and studentId by looking up their
 * Faculty, Staff or Student record (linked via User.personId).
 *
 * Results are cached in Redis for 15 minutes. A cached entry for a student
 * that predates studentId resolution is treated as a miss so it re-resolves.
 *
 * Role-to-model mapping:
 * - hod, faculty → Faculty model
 * - staff → Staff model
 * - student → Student model (studentId)
 * - Others (parent, admin) → look up User.personId only
 */
export async function resolveUserScope(
  userId: string,
  collegeId: string,
  role: string,
): Promise<UserScopeData> {
  // Check cache first
  try {
    const cached = await redis.get(cacheKey(userId));
    if (cached) {
      const parsedCache = JSON.parse(cached) as UserScopeData;
      // A cache entry written before studentId resolution existed lacks the
      // field for student-role users. Treat that as a miss so it re-resolves
      // and rewrites the cache; other roles are unaffected.
      if (!(role === 'student' && parsedCache.studentId === undefined)) {
        return parsedCache;
      }
    }
  } catch (_e) {
    // Cache miss — proceed to DB
  }

  const scope: UserScopeData = {};

  try {
    // Look up the user's personId
    const user = await User.findById(userId).select('personId').lean();
    const personId = user?.personId ? String(user.personId) : undefined;

    if (personId) {
      scope.personId = personId;

      if (role === 'hod' || role === 'faculty') {
        const faculty = await Faculty.findOne({ personId, collegeId }).lean();
        if (faculty?.departmentId) {
          scope.departmentId = String(faculty.departmentId);
        }
      } else if (role === 'staff') {
        const staff = await Staff.findOne({ personId, collegeId }).lean();
        if (staff?.departmentId) {
          scope.departmentId = String(staff.departmentId);
        }
      } else if (role === 'student') {
        const student = await Student.findOne({ personId, collegeId }).select('_id').lean();
        if (student) scope.studentId = String(student._id);
      }
    }
    if (scope.departmentId) {
      const branches = await Branch.find({ collegeId, departmentId: scope.departmentId }).select('_id').lean();
      scope.branchIds = branches.map((b) => String(b._id));
    }
  } catch (_e) {
    // Non-fatal: proceed without department/person resolution
  }

  // Cache the result
  try {
    await redis.set(cacheKey(userId), JSON.stringify(scope), 'EX', SCOPE_CACHE_TTL);
  } catch (_e) {
    // Non-fatal
  }

  return scope;
}

/**
 * Invalidate a user's cached scope (call on profile/department change).
 */
export async function invalidateUserScope(userId: string): Promise<void> {
  try {
    await redis.del(cacheKey(userId));
  } catch (_e) {
    // Non-fatal
  }
}
