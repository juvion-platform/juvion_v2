import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, join } from 'path';

/**
 * Static regression guard: prevents the
 * `.aggregate({ $match: { collegeId, ... } })` bug pattern from being
 * reintroduced anywhere in the backend.
 *
 * Why a test instead of an ESLint rule: the project doesn't have ESLint
 * configured. Spinning up ESLint + a custom AST rule for a single
 * pattern is heavier than this file. Vitest already runs in CI, already
 * has the tooling, and a regex-over-source scan is adequate for the
 * known bug shape.
 *
 * The bug:
 *   Mongoose auto-casts `collegeId: string` → `ObjectId` inside
 *   `.find({...})` but NOT inside `.aggregate([{ $match: {...} }])`.
 *   A raw string `collegeId` in a $match stage silently matches zero
 *   documents, so dashboards + analytics return zeros regardless of
 *   data. See PRs #23 / #24 / #25 for the history.
 *
 * The fix pattern:
 *   import mongoose from 'mongoose';
 *   // ...
 *   const cidObj = new mongoose.Types.ObjectId(collegeId);
 *   await Model.aggregate([
 *     { $match: { collegeId: cidObj, ... } },
 *     ...
 *   ]);
 *
 * What this guard detects:
 *   Literal `$match: { collegeId ... }` shapes where `collegeId` is
 *   followed by `,` or `}` (i.e. field-shorthand — the value is the
 *   raw outer `collegeId` variable, which is a string). Any correctly-
 *   fixed site uses `collegeId: cidObj` or `collegeId: someObjectId`,
 *   which this regex does NOT match.
 *
 * False-positive notes:
 *   - Comments containing the literal pattern are also flagged. Keep
 *     the pattern out of comments (or fix the comment to reference it
 *     indirectly).
 *   - String literals containing the pattern (e.g. documentation
 *     snippets) are flagged. Same mitigation.
 */

// Regex matches the buggy shorthand where `collegeId` is the FIRST key
// inside `$match: { ... }`, unbacked by a value. Examples flagged:
//   { $match: { collegeId } }
//   { $match: { collegeId, status: 'x' } }
// Examples NOT flagged (the fix shapes):
//   { $match: { collegeId: cidObj, ... } }
//   { $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } }
//   { $match: { collegeId: { $toObjectId: collegeId } } }  // inner `collegeId`
//                                                          // is a value, not a
//                                                          // shorthand key
// Keeping the regex tight (no `.*` between `{` and `collegeId`) prevents
// false positives where `collegeId` appears anywhere inside the pipeline
// as a value reference.
const BUG_PATTERN = /\$match:\s*\{\s*collegeId(\s*[,}])/g;

// Walk `dir` recursively, yielding absolute paths to `.ts` files while
// skipping directories we don't want to scan. Kept tiny on purpose — no
// new dependency needed.
function collectTsFiles(dir: string, excludeDirs: Set<string>): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      if (excludeDirs.has(entry)) continue;
      out.push(...collectTsFiles(full, excludeDirs));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('regression guard: aggregate collegeId ObjectId-casting', () => {
  it('no service file has $match: { collegeId } without explicit ObjectId wrap', () => {
    const root = resolve(__dirname, '../..'); // backend/src
    const files = collectTsFiles(root, new Set([
      '__tests__',
      'node_modules',
      'regression-guards', // this dir contains the pattern in comments / strings
    ]));

    const offenders: Array<{ file: string; line: number; snippet: string }> = [];
    for (const abs of files) {
      const content = readFileSync(abs, 'utf8');
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        // Skip comment-only lines so documentation examples don't trip it.
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (BUG_PATTERN.test(lineText)) {
          offenders.push({
            file: relative(root, abs),
            line: idx + 1,
            snippet: lineText.trim(),
          });
        }
        BUG_PATTERN.lastIndex = 0; // reset between lines for global flag
      });
    }

    // Produce a readable failure message if the guard trips
    const message = offenders.length > 0
      ? [
          '',
          `Found ${offenders.length} site(s) with the aggregate-collegeId bug pattern:`,
          ...offenders.map((o) => `  ${o.file}:${o.line}  →  ${o.snippet}`),
          '',
          'FIX: import mongoose from "mongoose"; then inside the function:',
          '  const cidObj = new mongoose.Types.ObjectId(collegeId);',
          '  await Model.aggregate([{ $match: { collegeId: cidObj, ... } }, ...]);',
          '',
          'See docs/tech-debt-remediation-plan.md P1-4 for background.',
        ].join('\n')
      : '';

    expect(offenders, message).toEqual([]);
  });
});

// ─── Self-test: the guard regex actually detects the bug pattern ─────
describe('regression guard: self-check on the detector regex', () => {
  it('flags the naive shape', () => {
    const sample = `const x = await Model.aggregate([{ $match: { collegeId } }]);`;
    BUG_PATTERN.lastIndex = 0;
    expect(BUG_PATTERN.test(sample)).toBe(true);
  });

  it('flags the multi-key naive shape (collegeId followed by comma)', () => {
    const sample = `{ $match: { collegeId, status: 'active' } }`;
    BUG_PATTERN.lastIndex = 0;
    expect(BUG_PATTERN.test(sample)).toBe(true);
  });

  it('does NOT flag the fix pattern (collegeId: cidObj)', () => {
    const sample = `{ $match: { collegeId: cidObj, status: 'active' } }`;
    BUG_PATTERN.lastIndex = 0;
    expect(BUG_PATTERN.test(sample)).toBe(false);
  });

  it('does NOT flag an unrelated ObjectId match', () => {
    const sample = `{ $match: { studentId } }`;
    BUG_PATTERN.lastIndex = 0;
    expect(BUG_PATTERN.test(sample)).toBe(false);
  });

  it('does NOT flag fix with new Types.ObjectId inline', () => {
    const sample = `{ $match: { collegeId: new mongoose.Types.ObjectId(collegeId) } }`;
    BUG_PATTERN.lastIndex = 0;
    expect(BUG_PATTERN.test(sample)).toBe(false);
  });
});
