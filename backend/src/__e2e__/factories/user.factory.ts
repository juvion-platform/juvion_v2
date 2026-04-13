import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../models/User';

const JWT_SECRET = 'test-secret';

interface CreateUserOpts {
  collegeId?: string;
  role: string;
  personaType: string;
  name: string;
  email: string;
  password?: string;
  personId?: string;
}

interface TestUser {
  user: InstanceType<typeof User>;
  token: string;
}

/**
 * Create a User document in the test DB and return it with a pre-signed JWT.
 */
export async function createTestUser(opts: CreateUserOpts): Promise<TestUser> {
  const password = opts.password ?? 'test123';
  const hashed = await bcrypt.hash(password, 4); // low rounds for speed

  const user = await User.create({
    collegeId: opts.collegeId,
    email: opts.email,
    password: hashed,
    name: opts.name,
    role: opts.role,
    personaType: opts.personaType,
    personId: opts.personId,
    isActive: true,
  });

  const token = createAuthToken({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    personaType: user.personaType,
    collegeId: opts.collegeId,
  });

  return { user, token };
}

/**
 * Generate a JWT without touching the DB.
 */
export function createAuthToken(payload: {
  id: string;
  name: string;
  email: string;
  role: string;
  personaType: string;
  collegeId?: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}
