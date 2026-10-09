import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User';
import mongoose from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { resolvePermissions, resolveSensitivity } from '../../shared/rbac/resolve-permissions';
import { personaCodesOf, loadPersonas } from '../../shared/rbac/persona-registry';

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

  const personas = personaCodesOf(user);
  const payload: any = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
    personas,
    tv: user.tokenVersion ?? 0,
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
      personas,
    },
  };

  if (isSuperAdmin) {
    // Return list of colleges for the selector
    const { College } = await import('../../models/College');
    const colleges = await College.find({ status: 'active' })
      .select('_id name code status logo juvi')
      .sort({ name: 1 })
      .lean();
    result.colleges = colleges.map((c) => ({
      _id: String(c._id),
      name: c.name,
      code: c.code,
      status: c.status,
      logo: c.logo,
      accentColor: c.juvi?.accentColor ?? null,
    }));
    result.isSuperAdmin = true;
  } else {
    result.collegeId = String(user.collegeId);
    result.college = await readCollegeBranding(String(user.collegeId));
  }

  const targetCollegeId = isSuperAdmin ? undefined : String(user.collegeId);
  result.permissions = await resolvePermissions(targetCollegeId, user.role, personas);
  result.sensitivity = await resolveSensitivity(targetCollegeId, user.role, personas);

  const personaRows = await loadPersonas(targetCollegeId);
  const userPersonaRows = personaRows.filter((p) => personas.includes(p.code));
  const primaryPersona = personaRows.find((p) => p.code === user.personaType) || userPersonaRows[0];
  const primaryModule = primaryPersona?.primaryModule || 'platform';
  const dashboardWidgets = [...new Set(userPersonaRows.flatMap((p) => p.dashboardWidgets || []))];
  const accessibleModules = [...new Set(userPersonaRows.flatMap((p) => p.accessibleModules || []))];

  const userObj = result.user as Record<string, unknown>;
  userObj.primaryModule = primaryModule;
  if (dashboardWidgets.length > 0) userObj.dashboardWidgets = dashboardWidgets;
  if (accessibleModules.length > 0) userObj.accessibleModules = accessibleModules;

  result.primaryModule = primaryModule;
  if (dashboardWidgets.length > 0) result.dashboardWidgets = dashboardWidgets;
  if (accessibleModules.length > 0) result.accessibleModules = accessibleModules;

  return result;
}

export interface CollegeBranding {
  id: string;
  name: string;
  code: string;
  logo?: string;
  accentColor: string | null;
}

/**
 * Reads the branding a portal session needs to theme itself.
 *
 * Deliberately NOT the juvi-app config reader: every authenticated portal user
 * must reach this, and `GET /juvi-app/admin/settings` requires `platform:read`,
 * which staff are explicitly denied (see DEFAULT_POLICIES). Riding `/auth/me`
 * needs no new route and no new permission.
 *
 * Returns null — never throws — so an unresolvable college degrades to the
 * portal's default palette instead of failing the whole session bootstrap.
 */
async function readCollegeBranding(collegeId?: string): Promise<CollegeBranding | null> {
  if (!collegeId || !mongoose.isValidObjectId(collegeId)) return null;
  const { College } = await import('../../models/College');
  const college = await College.findById(collegeId).select('name code logo juvi').lean();
  if (!college) return null;
  return {
    id: String(college._id),
    name: college.name,
    code: college.code,
    logo: college.logo,
    accentColor: college.juvi?.accentColor ?? null,
  };
}

export async function getMe(userId: string, requestedCollegeId?: string) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new AppError(404, 'User not found');
  const personas = personaCodesOf(user);
  const collegeId = user.collegeId ? String(user.collegeId) : undefined;
  // 010 — permissions ride on /me so a policy edit reaches the browser on its next hydrate.
  const permissions = await resolvePermissions(user.role === 'super_admin' ? undefined : collegeId, user.role, personas);
  const sensitivity = await resolveSensitivity(user.role === 'super_admin' ? undefined : collegeId, user.role, personas);

  const personaRows = await loadPersonas(collegeId);
  const userPersonaRows = personaRows.filter((p) => personas.includes(p.code));
  const primaryPersona = personaRows.find((p) => p.code === user.personaType) || userPersonaRows[0];
  const primaryModule = primaryPersona?.primaryModule || 'platform';
  const dashboardWidgets = [...new Set(userPersonaRows.flatMap((p) => p.dashboardWidgets || []))];
  const accessibleModules = [...new Set(userPersonaRows.flatMap((p) => p.accessibleModules || []))];

  // Branding for the portal's runtime theming.
  //
  // Deliberately NOT folded into the `collegeId` on line 105: that variable feeds
  // `resolvePermissions` and `loadPersonas` below, and widening it to a
  // superadmin's *selected* college would silently change which persona rows and
  // policies they resolve against. The portal's chrome is the only thing that
  // should follow a superadmin's college selection.
  //
  // A superadmin has no `collegeId` of their own, so the college they have
  // selected (`x-college-id` -> `req.collegeId`, resolved by `authenticate`) is
  // what supplies their branding. Everyone else is branded by their own college.
  const college = await readCollegeBranding(collegeId ?? requestedCollegeId);

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
    personas,
    collegeId: String(user.collegeId),
    permissions,
    sensitivity,
    primaryModule,
    // Null for a superadmin who has not selected a college; the portal then keeps
    // its default palette.
    college,
    dashboardWidgets: dashboardWidgets.length > 0 ? dashboardWidgets : undefined,
    accessibleModules: accessibleModules.length > 0 ? accessibleModules : undefined,
  };
}

export async function refreshToken(userId: string) {
  const user = await User.findById(userId).select('-password');
  if (!user || !user.isActive) throw new AppError(401, 'User not found or inactive');

  const isSuperAdmin = user.role === 'super_admin';
  const personas = personaCodesOf(user);
  const payload: Record<string, unknown> = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
    personas,
    tv: user.tokenVersion ?? 0,
  };
  if (!isSuperAdmin && user.collegeId) {
    payload.collegeId = String(user.collegeId);
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  const targetCollegeId = isSuperAdmin ? undefined : (user.collegeId ? String(user.collegeId) : undefined);
  const permissions = await resolvePermissions(targetCollegeId, user.role, personas);
  const sensitivity = await resolveSensitivity(targetCollegeId, user.role, personas);

  return { token, permissions, sensitivity };
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
    personas: [data.personaType || 'L-PRIN'],
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
