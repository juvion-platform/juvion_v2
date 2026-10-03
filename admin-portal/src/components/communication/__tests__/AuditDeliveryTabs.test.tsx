import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import AuditTab from '../AuditTab';
import DeliveryTab from '../DeliveryTab';
import DeadEventsPanel from '../DeadEventsPanel';
import { renderWithProviders, makeQueryClient } from '../../../__tests__/test-utils';
import { formatWhen } from '../../../lib/notices';
import type { NoticeDetail } from '../../../services/notices';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role } }) }));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/notices', () => ({ getNoticeAudit: vi.fn(), retryNoticeDelivery: vi.fn(), listDeadEvents: vi.fn() }));
import { getNoticeAudit, retryNoticeDelivery, listDeadEvents } from '../../../services/notices';
import { toast } from '../../../stores/toastStore';

/** 24-hex Mongo ObjectId shape — audit fixtures below use real-looking ids to prove they never render. */
const anId = (n: number) => `66f1a2b3c4d5e6f7a8b9c0d${n}`;
const ACK_AT = '2026-09-30T05:00:00.000Z';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: '2026-09-30T04:01:00.000Z' }, publishedAt: '2026-09-30T04:00:00.000Z',
  createdAt: '2026-09-30T04:00:00.000Z', ackRequired: true, deadline: null, deadlineState: 'none', counts: { audience: 120, onJuvi: 100 },
  acknowledged: 0, seen: 0, reminders: { used: 0, max: 2, lastAt: null }, isMine: true, body: 'x', attachments: [],
  audience: { rules: [{ kind: 'all', ids: [] }], line: 'Sent to everyone at JIT' }, ackCommentAllowed: false, priority: 'routine', confidential: false, urgentReason: null, archivedAt: null, canManage: true,
} as NoticeDetail;
const FAILED = { ...NOTICE, status: 'publishing', delivery: { state: 'failed', attempts: 8, lastError: 'Mongo timeout', updatedAt: '2026-09-30T04:30:00.000Z' } } as NoticeDetail;

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin';
  (getNoticeAudit as Mock).mockResolvedValue({
    items: [
      // Real shape from consumers.ts recordAcknowledgement: recipientId and sessionId must never render.
      { action: 'acknowledge', entityType: 'NoticeAcknowledgement', performedBy: 'Asha Rao', at: ACK_AT, changes: [{
        field: 'ack', displayName: 'Acknowledged', oldValue: null,
        newValue: { recipientId: anId(1), name: 'Asha Rao', at: ACK_AT, late: false, method: 'hold', offline: false, sessionId: anId(2), hasComment: false },
      }] },
      { action: 'publish', entityType: 'Notice', performedBy: 'Exam Officer', at: '2026-09-30T04:00:00.000Z', changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'publishing' }] },
    ],
  });
  (retryNoticeDelivery as Mock).mockResolvedValue({ state: 'delivering', attempts: 0, lastError: null, updatedAt: null });
  (listDeadEvents as Mock).mockResolvedValue({ items: [], total: 0, page: 1, pages: 0 });
});

describe('AuditTab', () => {
  it('lists the trail newest first with readable actions and changes', async () => {
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Acknowledged');
    expect(rows[0]).toHaveTextContent('Asha Rao');
    expect(rows[0]).toHaveTextContent(`Asha Rao acknowledged ${formatWhen(ACK_AT)} · by hold`);
    expect(rows[1]).toHaveTextContent('Published');
    expect(rows[1]).toHaveTextContent('Status: — → publishing');
    expect(getNoticeAudit).toHaveBeenCalledWith('n1');
    expect(table.textContent).not.toMatch(/[a-f0-9]{24}/i);
  });

  // Important (fix round 1): acknowledge and access_denied audit entries carry internal ids
  // (recipientId, sessionId, userId) alongside the fields worth showing. Both must summarize
  // into plain language and never leak an id, built from the exact shapes the writers record.
  it('summarizes a late, offline acknowledgement with a comment, and never shows its ids', async () => {
    (getNoticeAudit as Mock).mockResolvedValue({
      items: [{
        action: 'acknowledge', entityType: 'NoticeAcknowledgement', performedBy: 'Vikram Rao', at: ACK_AT,
        changes: [{
          field: 'ack', displayName: 'Acknowledged', oldValue: null,
          newValue: { recipientId: anId(1), name: 'Vikram Rao', at: ACK_AT, late: true, method: 'confirm', offline: true, sessionId: anId(2), hasComment: true },
        }],
      }],
    });
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    expect(table).toHaveTextContent(`Vikram Rao acknowledged ${formatWhen(ACK_AT)}, late · by confirm · offline · with a comment`);
    expect(table.textContent).not.toMatch(/[a-f0-9]{24}/i);
  });

  it('labels a refused reach attempt as "Reach refused" and never shows the user id', async () => {
    (getNoticeAudit as Mock).mockResolvedValue({
      items: [{
        // Real shape from reach-service.ts auditRefusal: userId must never render.
        action: 'access_denied', entityType: 'NoticeReach', performedBy: 'Ravi Student', at: '2026-09-30T05:10:00.000Z',
        changes: [{ field: 'remind', displayName: 'Refused: not the publisher', oldValue: null, newValue: { action: 'remind', via: 'mobile', role: 'student', userId: anId(3) } }],
      }],
    });
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Reach refused');
    expect(row).toHaveTextContent('Reach refused for a student (mobile)');
    expect(table.textContent).not.toMatch(/[a-f0-9]{24}/i);
  });

  it('labels an archive entry as "Archived"', async () => {
    (getNoticeAudit as Mock).mockResolvedValue({
      items: [{
        // Real shape from publish-service.ts archiveNotice.
        action: 'archive', entityType: 'Notice', performedBy: 'Exam Officer', at: '2026-09-30T05:20:00.000Z',
        changes: [{ field: 'status', displayName: 'Status', oldValue: 'published', newValue: 'archived' }],
      }],
    });
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Archived');
    expect(row).toHaveTextContent('Status: published → archived');
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

  it('announces the delivery state and refreshes the audit trail after a retry', async () => {
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<DeliveryTab notice={FAILED} />, { queryClient });
    expect(screen.getByRole('status')).toHaveTextContent('Delivery failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notice-audit', 'n1'] }));
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

describe('DeadEventsPanel', () => {
  // Minor (fix round 1): the panel fetches only the first page (limit 20), so once there
  // are more dead events than that it must say so rather than imply the list is complete.
  it('shows how many of the total are displayed when there are more than the page', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`, type: 'notice.published', noticeId: `n${i}`, attempts: 8, lastError: 'Mongo timeout', createdAt: '2026-09-30T04:00:00.000Z', updatedAt: null,
    }));
    (listDeadEvents as Mock).mockResolvedValue({ items, total: 23, page: 1, pages: 2 });
    renderWithProviders(<DeadEventsPanel />);
    await screen.findByRole('region', { name: /failed deliveries \(23\)/i });
    expect(screen.getByText('Showing 20 of 23.')).toBeInTheDocument();
  });

  it('says nothing about a partial page when every dead event is shown', async () => {
    (listDeadEvents as Mock).mockResolvedValue({ items: [{ id: 'e1', type: 'notice.published', noticeId: 'n1', attempts: 8, lastError: 'boom', createdAt: '2026-09-30T04:00:00.000Z', updatedAt: null }], total: 1, page: 1, pages: 1 });
    renderWithProviders(<DeadEventsPanel />);
    await screen.findByRole('region', { name: /failed deliveries \(1\)/i });
    expect(screen.queryByText(/^Showing /)).toBeNull();
  });
});
