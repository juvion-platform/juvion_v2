/**
 * Test-user fixtures for the Playwright E2E suite.
 *
 * Source of truth: `backend/src/scripts/seed-e2e-users.ts`. The seed
 * script creates these rows in Mongo before every CI run; this file
 * declares what we expect them to log in as on the client side.
 *
 * If you edit one, edit both — they drift silently otherwise. The
 * captain spec (.captain/specs/playwright-e2e/spec.md §AC-2) gates
 * the shared password.
 */

export type E2ERole = 'super_admin' | 'principal' | 'registrar';

export interface E2EUser {
  /** Email used in the login form. */
  email: string;
  /** Plaintext password the seed script hashes into Mongo. */
  password: string;
  /** Where the user lands after a successful login (per `Login.tsx`). */
  landingUrl: string;
}

export const E2E_TEST_PASSWORD = 'E2ETestPassword!';

export const TEST_USERS: Record<E2ERole, E2EUser> = {
  super_admin: {
    email: 'e2e_super@juvion.test',
    password: E2E_TEST_PASSWORD,
    // Per `admin-portal/src/pages/Login.tsx:44`, super_admin always
    // lands on the college picker (they have not selected a college
    // at login time).
    landingUrl: '/select-college',
  },
  principal: {
    email: 'e2e_principal@juvion.test',
    password: E2E_TEST_PASSWORD,
    // Per `admin-portal/src/pages/Login.tsx:48`, college-scoped users
    // land on `/` (the dashboard).
    landingUrl: '/',
  },
  // NOTE: this row's DB role is `staff` with personaType `ST-REG`, which
  // DEFAULT_POLICIES grants `people: *` and NOT `platform: *`. It exists so a
  // test can prove a people-gated surface actually works for the persona it
  // was built for. `super_admin` holds `*:*` and `principal` is DB role
  // `admin`, which also holds `*:*` — neither can distinguish a working
  // permission gate from an absent one.
  registrar: {
    email: 'e2e_registrar@juvion.test',
    password: E2E_TEST_PASSWORD,
    landingUrl: '/',
  },
};
