import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
import api from '../api';
import { listAccounts, downloadCredentialsCsv, createRun, listPendingDeletions } from '../juvi-app';

beforeEach(() => vi.clearAllMocks());

describe('juvi-app service', () => {
  it('listAccounts passes filters as query params and drops empties', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [], total: 0, page: 1, pages: 1 } });
    await listAccounts({ kind: 'student', q: '', page: 2, limit: 20 });
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/accounts', { params: { kind: 'student', page: 2, limit: 20 } });
  });

  // 011 T15 — no query input, so no params: the only scope is the caller's college, which the
  // request already carries. Sending an empty params object would be a place for a filter to
  // creep in later and look like it widened the list.
  it('listPendingDeletions calls the pending-deletion route with no filters', async () => {
    (api.get as any).mockResolvedValue({ data: { graceDays: 7, items: [] } });
    const out = await listPendingDeletions();
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/accounts/pending-deletion');
    expect(out.graceDays).toBe(7);
  });

  it('createRun posts the body and returns the run', async () => {
    (api.post as any).mockResolvedValue({ data: { _id: 'r1', status: 'queued' } });
    const run = await createRun({ kinds: ['student'], batchIds: ['b1'], resetExistingPasswords: true });
    expect(api.post).toHaveBeenCalledWith('/juvi-app/admin/provisioning/runs', { kinds: ['student'], batchIds: ['b1'], resetExistingPasswords: true });
    expect(run._id).toBe('r1');
  });

  it('downloadCredentialsCsv requests a blob for the group', async () => {
    (api.get as any).mockResolvedValue({ data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="juvi-credentials-2026-09-23.csv"' } });
    const out = await downloadCredentialsCsv('r1', { key: 'section', id: 's1' });
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/provisioning/runs/r1/credentials.csv', { params: { sectionId: 's1' }, responseType: 'blob' });
    expect(out.filename).toBe('juvi-credentials-2026-09-23.csv');
  });

  it('downloadCredentialsCsv asks for unsectioned rows only for the "No section" group', async () => {
    (api.get as any).mockResolvedValue({ data: new Blob(['x']), headers: {} });
    await downloadCredentialsCsv('r1', { key: 'none', id: null });
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/provisioning/runs/r1/credentials.csv', { params: { unsectioned: 'true' }, responseType: 'blob' });
  });
});
