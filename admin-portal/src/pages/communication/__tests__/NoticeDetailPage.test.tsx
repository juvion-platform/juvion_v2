import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { act, screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import NoticeDetailPage from '../NoticeDetailPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

vi.mock('../../../components/communication/ReachTab', () => ({ default: () => <p>Reach tab</p> }));
vi.mock('../../../components/communication/AuditTab', () => ({
  default: ({ record }: { record?: { urgentReason: string | null } }) => <p>Audit tab{record ? `: ${record.urgentReason}` : ''}</p>,
}));
vi.mock('../../../components/communication/DeliveryTab', () => ({ default: () => <p>Delivery tab</p> }));
vi.mock('../../../services/notices', () => ({ getNotice: vi.fn() }));
import { getNotice } from '../../../services/notices';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: null }, publishedAt: '2026-09-30T04:00:00.000Z', createdAt: '2026-09-30T04:00:00.000Z',
  ackRequired: true, deadline: null, deadlineState: 'none', counts: { audience: 10, onJuvi: 8 }, acknowledged: 4, seen: 3,
  reminders: { used: 0, max: 2, lastAt: null }, isMine: true,
  body: 'The timetable is attached.', attachments: [{ key: 'k1', name: 'timetable.pdf', mime: 'application/pdf', size: 2048 }],
  audience: { rules: [{ kind: 'batch', ids: ['b1'] }], line: 'Sent to 2024 Batch' },
  ackCommentAllowed: false, priority: 'urgent', confidential: true, urgentReason: 'Exam moved to today', archivedAt: null, canManage: true,
};

function renderAt(path: string) {
  return renderWithProviders(
    <Routes><Route path="/communication/notices/:id/*" element={<NoticeDetailPage />} /></Routes>,
    { route: path },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (getNotice as Mock).mockResolvedValue(NOTICE);
});

describe('NoticeDetailPage', () => {
  it('shows the notice and opens on the Reach tab', async () => {
    renderAt('/communication/notices/n1');
    expect(await screen.findByRole('heading', { name: 'Exam timetable' })).toBeInTheDocument();
    expect(getNotice).toHaveBeenCalledWith('n1');
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Confidential')).toBeInTheDocument();
    expect(screen.getByText(/Exam Section · Sent to 2024 Batch/)).toBeInTheDocument();
    expect(screen.getByText('The timetable is attached.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('timetable.pdf');
    expect(screen.getByRole('link', { name: 'Reach' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Reach tab')).toBeInTheDocument();
  });

  it('routes the Audit and Delivery tabs', async () => {
    renderAt('/communication/notices/n1/delivery');
    expect(await screen.findByText('Delivery tab')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Delivery' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Audit' })).toHaveAttribute('href', '/communication/notices/n1/audit');
  });

  it('hands the notice to the Audit tab for its publishing record', async () => {
    renderAt('/communication/notices/n1/audit');
    expect(await screen.findByText('Audit tab: Exam moved to today')).toBeInTheDocument();
  });

  it('says so when the notice is not one the caller can see', async () => {
    (getNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { error: 'Notice not found' } } });
    renderAt('/communication/notices/nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('This notice does not exist, or it is not one you can see.');
    expect(screen.getByRole('link', { name: 'Back to notices' })).toHaveAttribute('href', '/communication/notices');
  });

  it('keeps the page when a background refetch fails, with an inline alert', async () => {
    const { queryClient } = renderAt('/communication/notices/n1');
    expect(await screen.findByRole('heading', { name: 'Exam timetable' })).toBeInTheDocument();
    (getNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 503, data: { error: 'Service unavailable' } } });
    await act(async () => { await queryClient.refetchQueries({ queryKey: ['notice', 'n1'] }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
    expect(screen.getByRole('heading', { name: 'Exam timetable' })).toBeInTheDocument();
    expect(screen.getByText('Reach tab')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to notices' })).toBeNull();
  });
});
