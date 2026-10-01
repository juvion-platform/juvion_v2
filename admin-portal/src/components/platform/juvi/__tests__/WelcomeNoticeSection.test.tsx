import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import WelcomeNoticeSection from '../WelcomeNoticeSection';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ compose: true }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ hasPermission: () => perm.compose }) }));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../services/juvi-app', () => ({ getJuviSettings: vi.fn(), updateJuviSettings: vi.fn() }));
vi.mock('../../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn(), publishNotice: vi.fn(), uploadNoticeAttachment: vi.fn() }));
import { getJuviSettings, updateJuviSettings } from '../../../../services/juvi-app';
import { listNotices, getNoticeTargets, previewAudience, publishNotice } from '../../../../services/notices';
import { toast } from '../../../../stores/toastStore';

const view = (welcomeNotice?: object) => ({
  juvi: { enabled: true, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false }, ...(welcomeNotice ? { welcomeNotice } : {}) },
  college: { name: 'JIT', code: 'JIT' }, lastReconcile: null,
});
const row = (id: string, title: string, office = 'College Office') => ({ id, title, office, publishedAt: '2026-09-28T04:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks(); perm.compose = true;
  (getJuviSettings as Mock).mockResolvedValue(view({ studentNoticeId: 'w1' }));
  (listNotices as Mock).mockResolvedValue({ items: [row('w1', 'Welcome to Juvi', 'Juvi'), row('w2', 'Welcome to JIT')], total: 2, page: 1, pages: 1 });
  (updateJuviSettings as Mock).mockImplementation(async (patch: { welcomeNotice: object }) => view({ studentNoticeId: 'w1', ...patch.welcomeNotice }));
  (getNoticeTargets as Mock).mockResolvedValue({ office: 'College Office', offices: ['College Office'], isAdmin: true, timezone: 'Asia/Kolkata', kinds: ['all', 'role'], roles: ['student', 'faculty', 'staff', 'hod'], departments: [], programmes: [], batches: [], sections: [], courseOfferings: [], hostelBlocks: [] });
  (previewAudience as Mock).mockResolvedValue({ total: 40, onJuvi: 10, notOnJuvi: 30, groups: [], line: 'Sent to all students' });
});

describe('WelcomeNoticeSection', () => {
  it('offers Default plus the published welcome notices for each kind, showing the configured one', async () => {
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    const students = await screen.findByLabelText('Students');
    await waitFor(() => expect(within(students).getAllByRole('option')).toHaveLength(3));
    expect(students).toHaveValue('w1');
    expect(screen.getByLabelText('Faculty and staff')).toHaveValue('');
    expect(listNotices).toHaveBeenCalledWith({ page: 1, limit: 100, purpose: 'welcome', status: 'published' });
  });

  it('saves only the slots that changed, and Default as null', async () => {
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    const students = await screen.findByLabelText('Students');
    await waitFor(() => expect(within(students).getAllByRole('option')).toHaveLength(3));
    fireEvent.change(students, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Faculty and staff'), { target: { value: 'w2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save welcome notices' }));
    await waitFor(() => expect(updateJuviSettings).toHaveBeenCalledWith({ welcomeNotice: { studentNoticeId: null, facultyNoticeId: 'w2' } }));
    expect(toast.success).toHaveBeenCalledWith('Welcome notices saved');
  });

  it('opens the composer prefilled as a welcome notice for that kind', async () => {
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create welcome notice for faculty and staff' }));
    const dialog = screen.getByRole('dialog', { name: 'Welcome notice for faculty and staff' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Welcome to Juvi');
    expect(within(dialog).getByLabelText('Require acknowledgement')).toBeChecked();
    const tags = await within(dialog).findByRole('list', { name: 'Selected audience' });
    expect(tags).toHaveTextContent('All faculty');
    expect(tags).toHaveTextContent('All staff');
  });

  it('selects a welcome notice made in the composer in its slot, refetches the list, and saves it only on Save', async () => {
    (publishNotice as Mock).mockResolvedValue({ ...row('w3', 'Welcome, new faculty'), status: 'published', purpose: 'welcome' });
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create welcome notice for faculty and staff' }));
    const dialog = screen.getByRole('dialog', { name: 'Welcome notice for faculty and staff' });
    fireEvent.change(within(dialog).getByLabelText('Notice'), { target: { value: 'Hello.' } });
    await within(dialog).findByText(/10 on Juvi/);
    (listNotices as Mock).mockResolvedValue({ items: [row('w3', 'Welcome, new faculty'), row('w1', 'Welcome to Juvi', 'Juvi'), row('w2', 'Welcome to JIT')], total: 3, page: 1, pages: 1 });
    const callsBefore = (listNotices as Mock).mock.calls.length;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review and publish' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Publish notice' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const faculty = screen.getByLabelText('Faculty and staff');
    expect(faculty).toHaveValue('w3');
    expect(within(faculty).getByRole('option', { name: /Welcome, new faculty/ })).toBeInTheDocument();
    expect(within(faculty).queryByRole('option', { name: /no longer published/ })).toBeNull();
    await waitFor(() => expect((listNotices as Mock).mock.calls.length).toBeGreaterThan(callsBefore));
    expect(within(faculty).getAllByRole('option')).toHaveLength(4);   // Default + three, the new one not listed twice
    expect(updateJuviSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save welcome notices' }));
    await waitFor(() => expect(updateJuviSettings).toHaveBeenCalledWith({ welcomeNotice: { facultyNoticeId: 'w3' } }));
  });

  it('is read-only without platform:update and offers no composer without notices:create', async () => {
    perm.compose = false;
    renderWithProviders(<WelcomeNoticeSection canUpdate={false} />);
    expect(await screen.findByLabelText('Students')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save welcome notices' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /create welcome notice/i })).toBeNull();
  });
});
