/**
 * 010 S4 — per-user token version so a persona/role change or deactivation
 * takes effect on the next request instead of at JWT expiry.
 *
 * The JWT carries `tv`; `authenticate` compares it with the current version
 * (one Redis GET, falling back to Mongo on a miss). Bumping the version
 * invalidates every outstanding token for that user.
 */
import redis from '../../config/redis';
import { User } from '../../models/User';

const key = (userId: string) => `user:tv:${userId}`;
const TTL = 3600;

export async function getTokenVersion(userId: string): Promise<number> {
  try {
    const cached = await redis.get(key(userId));
    if (cached !== null) return Number(cached);
  } catch { /* fall through */ }
  const user = await User.findById(userId).select('tokenVersion').lean();
  const tv = user?.tokenVersion ?? 0;
  try { await redis.set(key(userId), String(tv), 'EX', TTL); } catch { /* non-fatal */ }
  return tv;
}

export async function bumpTokenVersion(userId: string): Promise<number> {
  const user = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true }).select('tokenVersion').lean();
  const tv = user?.tokenVersion ?? 0;
  try { await redis.set(key(userId), String(tv), 'EX', TTL); } catch { /* non-fatal */ }
  return tv;
}
