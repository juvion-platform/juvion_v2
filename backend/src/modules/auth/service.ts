import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User';
import { AppError } from '../../middleware/errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '7d';

export async function login(email: string, password: string, collegeId?: string) {
  // Try finding by email + collegeId first, fallback to email-only for superadmin
  let user = collegeId
    ? await User.findOne({ email, collegeId, isActive: true })
    : null;

  if (!user) {
    // Try superadmin (no collegeId on user)
    user = await User.findOne({ email, collegeId: { $exists: false }, isActive: true });
  }

  if (!user) {
    // Also try without collegeId filter for any user (in case collegeId not sent)
    if (!collegeId) {
      user = await User.findOne({ email, isActive: true });
    }
  }

  if (!user) throw new AppError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, 'Invalid email or password');

  const isSuperAdmin = user.role === 'super_admin';

  const payload: any = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
  };

  if (!isSuperAdmin) {
    payload.collegeId = String(user.collegeId);
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  const result: any = {
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      personaType: user.personaType,
    },
  };

  if (isSuperAdmin) {
    // Return list of colleges for the selector
    const { College } = await import('../../models/College');
    const colleges = await College.find({ status: 'active' })
      .select('_id name code status')
      .sort({ name: 1 })
      .lean();
    result.colleges = colleges;
    result.isSuperAdmin = true;
  } else {
    result.collegeId = String(user.collegeId);
  }

  return result;
}

export async function getMe(userId: string) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new AppError(404, 'User not found');
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
    collegeId: String(user.collegeId),
  };
}

export async function createUser(collegeId: string, data: { email: string; password: string; name: string; role?: string; personaType?: string; personId?: string }) {
  const existing = await User.findOne({ email: data.email, collegeId });
  if (existing) throw new AppError(409, 'User with this email already exists');

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    collegeId,
    email: data.email,
    password: hashedPassword,
    name: data.name,
    role: data.role || 'admin',
    personaType: data.personaType || 'L-PRIN',
    personId: data.personId || undefined,
  });

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
  };
}
