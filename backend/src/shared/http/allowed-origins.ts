/**
 * The CORS allowlist, in exactly one place.
 *
 * `app.ts` builds this to configure `cors()`, and the public account-deletion route
 * (`modules/juvi-app/accounts/public-deletion-routes.ts`, 011 Story 3 AC8) reads the **same** list to
 * decide whether a form POST's `Origin`/`Referer` is trustworthy. Two copies of the env precedence
 * would drift, and the drift would be silent and one-directional: the route would start rejecting a
 * legitimate same-origin submission that the browser's own CORS handling had already allowed, which
 * is a broken Play-mandated deletion page rather than a hole.
 *
 * A function rather than a module constant so the value is read at use, matching the way the rest of
 * the config is read.
 */
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
