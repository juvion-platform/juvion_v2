import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import NoticesPage from '../NoticesPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

const auth = vi.hoisted(() => ({ role: 'admin', can: true }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role }, hasPermission: () => auth.can }),
}));
vi.mock('../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn(), listDeadEvents: vi.fn() }));
import { listNotices, getNoticeTargets, listDeadEvents } from '../../../services/notices';

const ROW = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: null }, publishedAt: '2026-09-30T04:00:00.000Z', createdAt: '2026-09-30T04:00:00.000Z',
  ackRequired: true, deadline: '2030-01-01T00:00:00.000Z', deadlineState: 'open', counts: { audience: 120, onJuvi: 100 },
  acknowledged: 40, seen: 30, reminders: { used: 0, max: 2, lastAt: null }, isMine: true,
};
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pages: 1 });
const TARGETS = { office: 'College Office', offices: ['College Office', 'Exam Section'], isAdmin: true, timezone: 'Asia/Kolkata', kinds: [], roles: [], departments: [], programmes: [], batches: [], sections: [], courseOfferings: [], hostelBlocks: [] };

function renderPage(queryClient?: QueryClient) {
  return renderWithProviders(
    <Routes>
      <Route path="/communication/notices" element={<NoticesPage />} />
      <Route path="/communication/notices/:id" element={<p>Detail page</p>} />
    </Routes>,
    { route: '/communication/notices', ...(queryClient ? { queryClient } : {}) },
  );
}

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin'; auth.can = true;
  (listNotices as Mock).mockResolvedValue(page([ROW]));
  (getNoticeTargets as Mock).mockResolvedValue(TARGETS);
  (listDeadEvents as Mock).mockResolvedValue(page([]));
});
afterEach(() => { vi.useRealTimers(); });

describe('NoticesPage', () => {
  it('lists title, office, audience, counts, status and deadline, and opens the detail', async () => {
    renderPage();
    const row = await screen.findByRole('button', { name: /open notice exam timetable/i });
    expect(within(row).getByText('Exam Section')).toBeInTheDocument();
    expect(within(row).getByText('Sent to 2024 Batch')).toBeInTheDocument();
    expect(within(row).getByText('40 / 30 / 120')).toBeInTheDocument();
    expect(within(row).getByText('Published')).toBeInTheDocument();
    expect(within(row).getByText(/^Due /)).toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByText('Detail page')).toBeInTheDocument();
  });

  it('shows Delivering… and Delivery failed', async () => {
    (listNotices as Mock).mockResolvedValue(page([
      { ...ROW, id: 'n2', title: 'Fee notice', status: 'publishing', delivery: { state: 'delivering', attempts: 0, lastError: null, updatedAt: null } },
      { ...ROW, id: 'n3', title: 'Hostel notice', status: 'publishing', delivery: { state: 'failed', attempts: 8, lastError: 'boom', updatedAt: null } },
    ]));
    renderPage();
    expect(await screen.findByText('Delivering…')).toBeInTheDocument();
    expect(screen.getByText('Delivery failed')).toBeInTheDocument();
  });

  it('filters by status and, for admins, by office', async () => {
    renderPage();
    await screen.findByRole('button', { name: /open notice exam timetable/i });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
    await waitFor(() => expect(listNotices).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'archived', page: 1 })));
    fireEvent.change(await screen.findByLabelText('Office'), { target: { value: 'Exam Section' } });
    await waitFor(() => expect(listNotices).toHaveBeenLastCalledWith(expect.objectContaining({ office: 'Exam Section' })));
  });

  it('gives non-admins no office filter and no failed-deliveries panel', async () => {
    auth.role = 'staff';
    renderPage();
    await screen.findByRole('button', { name: /open notice exam timetable/i });
    expect(screen.queryByLabelText('Office')).toBeNull();
    expect(getNoticeTargets).not.toHaveBeenCalled();
    expect(listDeadEvents).not.toHaveBeenCalled();
  });

  it('shows admins the failed deliveries, linking to the Delivery tab', async () => {
    (listDeadEvents as Mock).mockResolvedValue(page([{ id: 'e1', type: 'notice.published', noticeId: 'n9', attempts: 8, lastError: 'Mongo timeout', createdAt: '2026-09-30T04:00:00.000Z', updatedAt: null }]));
    renderPage();
    const panel = await screen.findByRole('region', { name: /failed deliveries \(1\)/i });
    expect(panel).toHaveTextContent('Mongo timeout');
    expect(screen.getByRole('link', { name: 'Open delivery' })).toHaveAttribute('href', '/communication/notices/n9/delivery');
  });

  it('opens the composer drawer from New notice', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /new notice/i }));
    expect(screen.getByRole('dialog', { name: 'New notice' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers no New notice without notices:create', async () => {
    auth.can = false;
    renderPage();
    await screen.findByRole('button', { name: /open notice exam timetable/i });
    expect(screen.queryByRole('button', { name: /new notice/i })).toBeNull();
  });

  it('polls while a notice is still delivering', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (listNotices as Mock)
      .mockResolvedValueOnce(page([{ ...ROW, status: 'publishing', delivery: { state: 'delivering', attempts: 0, lastError: null, updatedAt: null }, counts: { audience: 0, onJuvi: 0 }, acknowledged: 0, seen: 0 }]))
      .mockResolvedValue(page([ROW]));
    renderPage();
    expect(await screen.findByText('Delivering…')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(await screen.findByText('40 / 30 / 120')).toBeInTheDocument();
    expect(listNotices).toHaveBeenCalledTimes(2);
  });

  it('shows a failed poll inline instead of handing it to the global error toast', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Mirrors main.tsx: the query cache toasts every failed read unless it is meta.silentError.
    const toasted = vi.fn();
    const queryClient = new QueryClient({
      queryCache: new QueryCache({ onError: (_e, q) => { if (!(q.meta as { silentError?: boolean } | undefined)?.silentError) toasted(q.queryKey[0]); } }),
      defaultOptions: { queries: { retry: false } },
    });
    (listNotices as Mock)
      .mockResolvedValueOnce(page([{ ...ROW, status: 'publishing', delivery: { state: 'delivering', attempts: 0, lastError: null, updatedAt: null } }]))
      .mockRejectedValue({ isAxiosError: true, response: { status: 503, data: { error: 'Service unavailable' } } });
    renderPage(queryClient);
    expect(await screen.findByText('Delivering…')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(toasted).not.toHaveBeenCalledWith('notices');
  });
});
