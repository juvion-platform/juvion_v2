import { z } from 'zod';

/**
 * Zod schema for the global people-search query string.
 *
 * Validates `GET /api/people/search?q=...&limit=...&includeInactive=...`.
 *
 * Philosophy:
 *   - `q` whitelisted charset keeps user input safely outside the risk
 *     set for regex bombs, XSS when echoed back in errors, and Mongo
 *     operator injection. Letters, digits, spaces, and a small set of
 *     punctuation (@ . - +) are enough for names, emails, phone
 *     fragments, and role identifiers (roll numbers, employee codes).
 *   - `limit` and `includeInactive` use Zod coercion because req.query
 *     values are always strings from the HTTP layer.
 */

// Allowed characters in a search query. Any character outside this set
// fails validation. Keep tight — broader surface = more abuse potential.
const Q_CHARSET = /^[A-Za-z0-9 @.\-+]+$/;

export const searchQuerySchema = z.object({
  q: z.string()
    .transform((s) => s.trim())
    .pipe(
      z.string()
        .min(2, 'query must be at least 2 characters')
        .max(100, 'query must be at most 100 characters')
        .regex(Q_CHARSET, 'query contains disallowed characters'),
    ),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .pipe(z.number().int().min(1).max(25).optional())
    .transform((v) => v ?? 10),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return false;
      if (typeof v === 'boolean') return v;
      return v.toLowerCase() === 'true';
    }),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
