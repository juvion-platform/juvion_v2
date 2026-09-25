import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
import api from '../api';
import { listAccounts, downloadCredentialsCsv, createRun } from '../juvi-app';

beforeEach(() => vi.clearAllMocks());

describe('juvi-app service', () => {
  it('listAccounts passes filters as query params and drops empties', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [], total: 0, page: 1, pages: 1 } });
    await listAccounts({ kind: 'student', q: '', page: 2, limit: 20 });
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/accounts', { params: { kind: 'student', page: 2, limit: 20 } });
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
});
