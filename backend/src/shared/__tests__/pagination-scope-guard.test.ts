import { describe, it, expect } from 'vitest';
import { paginate } from '../pagination';
import { runWithListContext } from '../request-context';
import { applyAuthScope } from '../rbac/apply-scope';

/** 010 S4 — a scoped request must never reach the DB with an un-scoped filter. */
describe('paginate scope guard', () => {
  const model = { modelName: 'Thing' } as any; // never reached when the guard fires

  it('throws when the request is scoped and the filter skipped applyAuthScope', async () => {
    await expect(runWithListContext({ scoped: true }, () => paginate(model, { collegeId: 'c1' })))
      .rejects.toThrow(/Row scope not applied to Thing/);
  });

  it('is silent when the filter was scoped or the request is not', async () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { departmentOnly: false, selfOnly: false, userId: 'u', resolvedPermissions: [] });
    // Passing the guard means reaching model.find, which this stub lacks — that error is the proof.
    await expect(runWithListContext({ scoped: true }, () => paginate(model, filter))).rejects.toThrow(/find is not a function/);
    await expect(runWithListContext({}, () => paginate(model, { collegeId: 'c1' }))).rejects.toThrow(/find is not a function/);
  });
});
