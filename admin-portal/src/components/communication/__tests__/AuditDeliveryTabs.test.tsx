import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import AuditTab from '../AuditTab';
import DeliveryTab from '../DeliveryTab';
import { renderWithProviders } from '../../../__tests__/test-utils';
import type { NoticeDetail } from '../../../services/notices';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role } }) }));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/notices', () => ({ getNoticeAudit: vi.fn(), retryNoticeDelivery: vi.fn() }));
import { getNoticeAudit, retryNoticeDelivery } from '../../../services/notices';
import { toast } from '../../../stores/toastStore';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: '2026-09-30T04:01:00.000Z' }, publishedAt: '2026-09-30T04:00:00.000Z',
  createdAt: '2026-09-30T04:00:00.000Z', ackRequired: true, deadline: null, deadlineState: 'none', counts: { audience: 120, onJuvi: 100 },
  acknowledged: 0, seen: 0, reminders: { used: 0, max: 2, lastAt: null }, isMine: true, body: 'x', attachments: [],
  audience: { rules: [{ kind: 'all', ids: [] }], line: 'Sent to everyone at JIT' }, ackCommentAllowed: false, priority: 'routine', archivedAt: null, canManage: true,
} as NoticeDetail;
const FAILED = { ...NOTICE, status: 'publishing', delivery: { state: 'failed', attempts: 8, lastError: 'Mongo timeout', updatedAt: '2026-09-30T04:30:00.000Z' } } as NoticeDetail;

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin';
  (getNoticeAudit as Mock).mockResolvedValue({
    items: [
      { action: 'acknowledge', entityType: 'NoticeAcknowledgement', performedBy: 'Asha Rao', at: '2026-09-30T05:00:00.000Z', changes: [{ field: 'ack', displayName: 'Acknowledged', oldValue: null, newValue: { late: false, method: 'hold' } }] },
      { action: 'publish', entityType: 'Notice', performedBy: 'Exam Officer', at: '2026-09-30T04:00:00.000Z', changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'publishing' }] },
    ],
  });
  (retryNoticeDelivery as Mock).mockResolvedValue({ state: 'delivering', attempts: 0, lastError: null, updatedAt: null });
});

describe('AuditTab', () => {
  it('lists the trail newest first with readable actions and changes', async () => {
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Acknowledged');
    expect(rows[0]).toHaveTextContent('Asha Rao');
    expect(rows[0]).toHaveTextContent('Acknowledged: — → late: false, method: hold');
    expect(rows[1]).toHaveTextContent('Published');
    expect(rows[1]).toHaveTextContent('Status: — → publishing');
    expect(getNoticeAudit).toHaveBeenCalledWith('n1');
  });

  // R1: the backend writes `action: 'update'` for both a sent reminder (publish-service.ts
  // remindNotice) and a retried delivery (admin-service.ts retryDelivery). The label comes
  // from what each entry's own changes record, not from the action code.
  it('labels a reminder update as "Reminder sent"', async () => {
    (getNoticeAudit as Mock).mockResolvedValue({
      items: [{ action: 'update', entityType: 'Notice', performedBy: 'Exam Officer', at: '2026-09-30T05:00:00.000Z', changes: [{ field: 'reminders', displayName: 'Reminders sent', oldValue: 0, newValue: 1 }] }],
    });
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Reminder sent');
    expect(row).toHaveTextContent('Reminders sent: 0 → 1');
  });

  it('labels a retried-delivery update as "Delivery retried"', async () => {
    (getNoticeAudit as Mock).mockResolvedValue({
      items: [{ action: 'update', entityType: 'Notice', performedBy: 'Super Admin', at: '2026-09-30T05:00:00.000Z', changes: [{ field: 'delivery', displayName: 'Delivery', oldValue: 'failed', newValue: 'retried' }] }],
    });
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Delivery retried');
    expect(row).toHaveTextContent('Delivery: failed → retried');
  });

  it('falls back to "Updated" when an update entry does not say which', async () => {
    (getNoticeAudit as Mock).mockResolvedValue({
      items: [{ action: 'update', entityType: 'Notice', performedBy: 'Someone', at: '2026-09-30T05:00:00.000Z', changes: [{ field: 'title', displayName: 'Title', oldValue: 'a', newValue: 'b' }] }],
    });
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Updated');
  });
});

describe('DeliveryTab', () => {
  it('shows a delivered notice with its recipients', () => {
    renderWithProviders(<DeliveryTab notice={NOTICE} />);
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('120 (100 on Juvi)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry delivery' })).toBeNull();
  });

  it('lets an admin retry a failed delivery', async () => {
    renderWithProviders(<DeliveryTab notice={FAILED} />);
    expect(screen.getByText('Delivery failed')).toBeInTheDocument();
    expect(screen.getByText(/stopped after 8 attempts\. Last error: Mongo timeout/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
    await waitFor(() => expect(retryNoticeDelivery).toHaveBeenCalledWith('n1'));
    expect(toast.success).toHaveBeenCalledWith('Delivery retried', expect.any(String));
  });

  it('shows the server reason when a retry is refused', async () => {
    (retryNoticeDelivery as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { error: 'Nothing to retry: delivery has not failed' } } });
    renderWithProviders(<DeliveryTab notice={FAILED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not retry delivery', 'Nothing to retry: delivery has not failed'));
  });

  it('sends non-admins to an admin', () => {
    auth.role = 'staff';
    renderWithProviders(<DeliveryTab notice={FAILED} />);
    expect(screen.queryByRole('button', { name: 'Retry delivery' })).toBeNull();
    expect(screen.getByText('Ask a college admin to retry delivery.')).toBeInTheDocument();
  });
});
