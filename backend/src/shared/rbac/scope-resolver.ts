import redis from '../../config/redis';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { User } from '../../models/User';

const SCOPE_CACHE_TTL = 900; // 15 minutes

interface UserScopeData {
  departmentId?: string;
  personId?: string;
}

function cacheKey(userId: string): string {
  return `user:scope:${userId}`;
}

/**
 * Resolve a user's departmentId and personId by looking up their
 * Faculty or Staff record (linked via User.personId).
 *
 * Results are cached in Redis for 15 minutes.
 *
 * Role-to-model mapping:
 * - hod, faculty → Faculty model
 * - staff → Staff model
 * - Others (student, parent, admin) → look up User.personId only
 */
export async function resolveUserScope(
  userId: string,
  collegeId: string,
  role: string,
): Promise<UserScopeData> {
  // Check cache first
  try {
    const cached = await redis.get(cacheKey(userId));
    if (cached) return JSON.parse(cached);
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
      }
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
