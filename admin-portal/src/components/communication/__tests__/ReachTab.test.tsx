import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import ReachTab from '../ReachTab';
import { renderWithProviders, makeQueryClient } from '../../../__tests__/test-utils';
import type { NoticeDetail, Reach } from '../../../services/notices';

const auth = vi.hoisted(() => ({ role: 'admin', perms: ['notices:update'] }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role }, hasPermission: (m: string, a: string) => auth.perms.includes(`${m}:${a}`) }),
}));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const confirm = vi.hoisted(() => ({ confirmed: true }));
vi.mock('../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve(confirm)) }));
vi.mock('../../../services/juvi-app', () => ({ saveBlob: vi.fn() }));
vi.mock('../../../services/notices', () => ({
  getReach: vi.fn(), getPending: vi.fn(), getAllPending: vi.fn(), downloadReachCsv: vi.fn(), remindNotice: vi.fn(), archiveNotice: vi.fn(),
}));
import { getReach, getPending, getAllPending, downloadReachCsv, remindNotice, archiveNotice } from '../../../services/notices';
import { saveBlob } from '../../../services/juvi-app';
import { toast } from '../../../stores/toastStore';
import { confirmAction } from '../../../stores/confirmStore';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: null }, publishedAt: '2026-09-30T04:00:00.000Z', createdAt: '2026-09-30T04:00:00.000Z',
  ackRequired: true, deadline: '2026-10-05T11:30:00.000Z', deadlineState: 'open', counts: { audience: 10, onJuvi: 8 }, acknowledged: 4, seen: 3,
  reminders: { used: 1, max: 2, lastAt: '2026-09-30T06:00:00.000Z' }, isMine: true,
  body: 'Attached.', attachments: [], audience: { rules: [{ kind: 'batch', ids: ['b1'] }], line: 'Sent to 2024 Batch' },
  ackCommentAllowed: true, priority: 'routine', confidential: false, urgentReason: null, archivedAt: null, canManage: true,
} as NoticeDetail;
const person = (name: string, extra: object = {}) => ({ name, identifier: `24JIT-${name[0]}`, group: '2024 Batch · Section A', at: '2026-10-06T04:00:00.000Z', ...extra });
const REACH: Reach = {
  noticeId: 'n1', title: 'Exam timetable', status: 'published', ackRequired: true, deadline: NOTICE.deadline, publishedAt: NOTICE.publishedAt,
  audience: 10, acknowledged: 4, seen: 3, notSeen: 1, notOnJuvi: 2, dismissed: 0, late: 1,
  reminders: { used: 1, max: 2, lastAt: '2026-09-30T06:00:00.000Z' }, sparkline: [],
  groups: [{ label: '2024 Batch · Section A', total: 10, acknowledged: 4, seen: 3, notSeen: 1, notOnJuvi: 2 }],
  lateAcks: [person('Lata Late')],
  comments: [{ ...person('Chitra Comment'), comment: 'Will the hall change?', late: false }],
  addedLater: { total: 1, acknowledged: 0, seen: 1, items: [{ ...person('Arjun Added'), state: 'seen' }] },
  delivery: { scheduled: 0, sent: 0, delivered: 0, opened: 0, failed: 0, cancelled: 0, suppressed: { muted: 0, tierOff: 0, noDevice: 0 } },
  asOf: '2026-10-01T04:00:00.000Z',
};
const PENDING = (items: object[], nextCursor: string | null = null) => ({ items, total: 3, groups: [{ label: '2024 Batch · Section A', count: 3 }], nextCursor });
const pendingPerson = (name: string, state = 'not_seen') => ({ name, identifier: null, group: '2024 Batch · Section A', state, lastSeenInApp: state === 'not_on_juvi' ? null : '2026-09-29T04:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin'; auth.perms = ['notices:update']; confirm.confirmed = true;
  (getReach as Mock).mockResolvedValue(REACH);
  (getPending as Mock).mockImplementation(async (_id: string, q: { cursor?: string }) =>
    (q.cursor ? PENDING([pendingPerson('Pallavi Pending')]) : PENDING([pendingPerson('Nikhil Notseen'), pendingPerson('Omar Offline', 'not_on_juvi')], 'c2')));
  (remindNotice as Mock).mockResolvedValue({ reminders: { used: 2, max: 2, lastAt: '2026-10-01T05:00:00.000Z' } });
  (archiveNotice as Mock).mockResolvedValue({ status: 'archived', archivedAt: '2026-10-01T05:00:00.000Z' });
});

describe('ReachTab', () => {
  it('reconciles the counts to the snapshot and breaks them down by group', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    expect(await screen.findByText('4 acknowledged + 3 seen + 1 not seen + 2 not on Juvi = 10 in the audience snapshot')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Reach summary' });
    expect(within(summary).getByText('Seen, not acknowledged')).toBeInTheDocument();
    expect(within(summary).getByText(/1 acknowledged late/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    const groups = screen.getByRole('region', { name: 'By batch, section or department' });
    expect(within(groups).getByText('2024 Batch · Section A')).toBeInTheDocument();
  });

  it('pages and searches the pending list, with last-seen-in-app', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    const table = await screen.findByRole('table', { name: 'Pending members' });
    expect(within(table).getByText('Nikhil Notseen')).toBeInTheDocument();
    expect(within(table).getByText('Not on Juvi')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await within(table).findByText('Pallavi Pending')).toBeInTheDocument();
    expect(getPending).toHaveBeenLastCalledWith('n1', { cursor: 'c2', limit: 50 });
    fireEvent.change(screen.getByLabelText('Search pending'), { target: { value: 'nik' } });
    await waitFor(() => expect(getPending).toHaveBeenLastCalledWith('n1', { q: 'nik', limit: 50 }));
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: '2024 Batch · Section A' } });
    await waitFor(() => expect(getPending).toHaveBeenLastCalledWith('n1', { q: 'nik', group: '2024 Batch · Section A', limit: 50 }));
  });

  it('lists late acknowledgements, comments and added-later members separately', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    expect(await screen.findByRole('table', { name: 'Late acknowledgements' })).toHaveTextContent('Lata Late');
    expect(screen.getByText('Will the hall change?')).toBeInTheDocument();
    const later = screen.getByRole('table', { name: 'Added later' });
    expect(within(later).getByText('Arjun Added')).toBeInTheDocument();
    expect(screen.getByText(/They are not counted as pending/)).toBeInTheDocument();
  });

  it('confirms and sends a reminder, then shows the cap reached', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remind (1 of 2 used)' }));
    await waitFor(() => expect(remindNotice).toHaveBeenCalledWith('n1'));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Send a reminder?', message: expect.stringContaining('This is the last reminder you can send.') }));
    expect(toast.success).toHaveBeenCalledWith('Reminder sent', '2 of 2 reminders used.');
    expect(await screen.findByRole('button', { name: 'Remind (2 of 2 used)' })).toBeDisabled();
  });

  it('shows a refused third reminder with the server reason and the count it carries', async () => {
    (remindNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { error: 'A notice can have at most two reminders.', detail: { reminders: { used: 2, max: 2, lastAt: null } } } } });
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remind (1 of 2 used)' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not send the reminder', 'A notice can have at most two reminders.'));
    expect(await screen.findByRole('button', { name: 'Remind (2 of 2 used)' })).toBeDisabled();
  });

  it('archives after a danger confirmation', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archiveNotice).toHaveBeenCalledWith('n1'));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    expect(toast.success).toHaveBeenCalledWith('Notice archived', expect.any(String));
  });

  it('refreshes the audit trail after a reminder and after archiving', async () => {
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<ReachTab notice={NOTICE} />, { queryClient });
    fireEvent.click(await screen.findByRole('button', { name: 'Remind (1 of 2 used)' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notice-audit', 'n1'] }));
    invalidate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archiveNotice).toHaveBeenCalled());
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notice-audit', 'n1'] }));
  });

  it('offers Remind and Archive only with notices:update and a notice the caller manages', async () => {
    auth.perms = [];
    const { unmount } = renderWithProviders(<ReachTab notice={NOTICE} />);
    await screen.findByText(/in the audience snapshot/);
    expect(screen.queryByRole('button', { name: /^Remind/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    unmount();
    auth.perms = ['notices:update'];
    renderWithProviders(<ReachTab notice={{ ...NOTICE, canManage: false }} />);
    await screen.findByText(/in the audience snapshot/);
    expect(screen.queryByRole('button', { name: /^Remind/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  it('does nothing when a confirmation is cancelled', async () => {
    confirm.confirmed = false;
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalled());
    expect(archiveNotice).not.toHaveBeenCalled();
  });

  it('exports CSV for admins only', async () => {
    (downloadReachCsv as Mock).mockResolvedValue({ blob: new Blob(['x']), filename: 'notice-reach-abc123.csv' });
    const { unmount } = renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'notice-reach-abc123.csv'));
    unmount();
    auth.role = 'staff';
    renderWithProviders(<ReachTab notice={NOTICE} />);
    await screen.findByText(/in the audience snapshot/);
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('copies every pending member as grouped text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    (getAllPending as Mock).mockResolvedValue([pendingPerson('Nikhil Notseen'), pendingPerson('Omar Offline', 'not_on_juvi')]);
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy pending list' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain('Pending for "Exam timetable": 2');
    expect(text).toContain('- Omar Offline: Not on Juvi');
    expect(toast.success).toHaveBeenCalledWith('Pending list copied', '2 people.');
  });

  it('waits for delivery before asking for reach', () => {
    renderWithProviders(<ReachTab notice={{ ...NOTICE, status: 'publishing' }} />);
    expect(screen.getByText(/Reach appears once delivery has finished/)).toBeInTheDocument();
    expect(getReach).not.toHaveBeenCalled();
  });
});
