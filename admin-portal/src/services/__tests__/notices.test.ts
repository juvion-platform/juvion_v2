import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../api';
import { listNotices, previewAudience, uploadNoticeAttachment, getAllPending, downloadReachCsv, searchNoticePeople, publishNotice } from '../notices';

const BASE = '/juvi-app/admin/notices';
beforeEach(() => vi.clearAllMocks());

describe('notices service', () => {
  it('listNotices drops empty filters', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [], total: 0, page: 1, pages: 1 } });
    await listNotices({ page: 1, limit: 20, q: '', office: undefined, status: 'published' });
    expect(api.get).toHaveBeenCalledWith(BASE, { params: { page: 1, limit: 20, status: 'published' } });
  });

  it('previewAudience sends the office only when one is chosen', async () => {
    (api.post as any).mockResolvedValue({ data: { total: 1 } });
    await previewAudience([{ kind: 'all', ids: [] }]);
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/audience-preview`, { rules: [{ kind: 'all', ids: [] }] });
    await previewAudience([{ kind: 'all', ids: [] }], 'Exam Section');
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/audience-preview`, { rules: [{ kind: 'all', ids: [] }], office: 'Exam Section' });
  });

  it('searchNoticePeople and publishNotice hit their routes', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [] } });
    await searchNoticePeople('asha');
    expect(api.get).toHaveBeenCalledWith(`${BASE}/targets/people`, { params: { q: 'asha' } });
    (api.post as any).mockResolvedValue({ data: { id: 'n1' } });
    const input = { title: 't', body: 'b', attachments: [], audience: { rules: [{ kind: 'all' as const, ids: [] }] }, ackRequired: false, ackCommentAllowed: false, priority: 'routine' as const, purpose: 'standard' as const };
    expect((await publishNotice(input)).id).toBe('n1');
    expect(api.post).toHaveBeenCalledWith(BASE, input);
  });

  it('uploadNoticeAttachment posts multipart and reports progress', async () => {
    (api.post as any).mockImplementation(async (_url: string, _fd: FormData, cfg: any) => {
      cfg.onUploadProgress({ loaded: 50, total: 100 });
      return { data: { key: 'colleges/c/notices/u', name: 'a.pdf', mime: 'application/pdf', size: 100 } };
    });
    const progress: number[] = [];
    const out = await uploadNoticeAttachment(new File(['x'], 'a.pdf', { type: 'application/pdf' }), (p) => progress.push(p));
    expect(out.key).toBe('colleges/c/notices/u');
    expect(progress).toEqual([50]);
    const [url, body, cfg] = (api.post as any).mock.calls[0];
    expect(url).toBe(`${BASE}/attachments`);
    expect(body).toBeInstanceOf(FormData);
    expect(cfg.headers).toEqual({ 'Content-Type': 'multipart/form-data' });
  });

  it('getAllPending follows the cursor until it runs out', async () => {
    (api.get as any)
      .mockResolvedValueOnce({ data: { items: [{ name: 'A' }], total: 2, groups: [], nextCursor: 'c2' } })
      .mockResolvedValueOnce({ data: { items: [{ name: 'B' }], total: 2, groups: [], nextCursor: null } });
    const all = await getAllPending('n1', { q: 'a' });
    expect(all.map((p) => p.name)).toEqual(['A', 'B']);
    expect(api.get).toHaveBeenNthCalledWith(1, `${BASE}/n1/reach/pending`, { params: { q: 'a', limit: 200 } });
    expect(api.get).toHaveBeenNthCalledWith(2, `${BASE}/n1/reach/pending`, { params: { q: 'a', cursor: 'c2', limit: 200 } });
  });

  it('downloadReachCsv returns the blob and the server file name', async () => {
    (api.get as any).mockResolvedValue({ data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="notice-reach-abc123.csv"' } });
    const out = await downloadReachCsv('n1');
    expect(api.get).toHaveBeenCalledWith(`${BASE}/n1/reach.csv`, { responseType: 'blob' });
    expect(out.filename).toBe('notice-reach-abc123.csv');
  });
});
