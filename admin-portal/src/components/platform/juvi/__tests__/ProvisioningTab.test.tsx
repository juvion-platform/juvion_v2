import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ProvisioningTab from '../ProvisioningTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (sel: any) => sel({ hasPermission: () => perm.can }) }));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve({ confirmed: true })) }));
vi.mock('../../../../services/academics', () => ({ listProgrammes: vi.fn(), listBatches: vi.fn(), listDepartments: vi.fn() }));
vi.mock('../../../../services/juvi-app', () => ({
  getJuviSettings: vi.fn(), listRuns: vi.fn(), createRun: vi.fn(), getCredentialGroups: vi.fn(), downloadCredentialsCsv: vi.fn(), saveBlob: vi.fn(),
  listAccounts: vi.fn(), deactivateAccount: vi.fn(), resetAccountPassword: vi.fn(), revealAccountCredential: vi.fn(),
}));
import { listProgrammes, listBatches, listDepartments } from '../../../../services/academics';
import { getJuviSettings, listRuns, createRun, getCredentialGroups, downloadCredentialsCsv, saveBlob, listAccounts } from '../../../../services/juvi-app';

const RUN = { _id: 'r1', status: 'completed', filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, counts: { scanned: 40, created: 38, existingLinked: 2, skipped: 0, failed: 0 }, errors: [], performedBy: 'Admin', startedAt: '2026-09-23T03:00:00Z', finishedAt: '2026-09-23T03:02:00Z', credentialsExpireAt: '2026-09-30T03:00:00Z', createdAt: '2026-09-23T03:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks(); perm.can = true;
  (listProgrammes as Mock).mockResolvedValue({ items: [{ _id: 'p1', code: 'BTECH', name: 'B.Tech' }] });
  (listBatches as Mock).mockResolvedValue({ items: [{ _id: 'b1', code: '2024', name: '2024 Batch' }] });
  (listDepartments as Mock).mockResolvedValue({ items: [{ _id: 'd1', code: 'CSE', name: 'Computer Science' }] });
  (getJuviSettings as Mock).mockResolvedValue({ juvi: { enabled: true, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false } }, college: { name: 'JIT', code: 'JIT' }, lastReconcile: null });
  (listRuns as Mock).mockResolvedValue({ items: [RUN], total: 1, page: 1, pages: 1 });
  (listAccounts as Mock).mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  (createRun as Mock).mockResolvedValue({ ...RUN, _id: 'r2', status: 'queued' });
  (getCredentialGroups as Mock).mockResolvedValue({ expiresAt: RUN.credentialsExpireAt, live: true, groups: [{ key: 'section', id: 's1', label: 'Section A', count: 20 }, { key: 'none', id: null, label: 'No section', count: 18 }] });
  (downloadCredentialsCsv as Mock).mockResolvedValue({ blob: new Blob(['x']), filename: 'juvi-credentials.csv' });
});

describe('ProvisioningTab', () => {
  it('lists runs with counts and lets the admin start a filtered run', async () => {
    renderWithProviders(<ProvisioningTab />);
    expect(await screen.findByText(/38 created/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^new run$/i }));
    await screen.findByRole('option', { name: /2024 Batch/ });
    fireEvent.click(screen.getByLabelText(/^faculty$/i));
    fireEvent.change(screen.getByLabelText(/^batch$/i), { target: { value: 'b1' } });
    fireEvent.click(screen.getByLabelText(/reset passwords of people who already have a login/i));
    fireEvent.click(screen.getByRole('button', { name: /^start run$/i }));
    await waitFor(() => expect(createRun).toHaveBeenCalledWith({ kinds: ['student', 'faculty'], batchIds: ['b1'], resetExistingPasswords: true }));
  });

  it('opens a run and downloads a section CSV', async () => {
    renderWithProviders(<ProvisioningTab />);
    fireEvent.click(await screen.findByRole('button', { name: /open run/i }));
    expect(await screen.findByText(/Section A/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /download section a/i }));
    await waitFor(() => expect(downloadCredentialsCsv).toHaveBeenCalledWith('r1', { key: 'section', id: 's1' }));
    expect(saveBlob).toHaveBeenCalled();
  });

  it('hides New run and points to Settings while Juvi is disabled', async () => {
    (getJuviSettings as Mock).mockResolvedValue({ juvi: { enabled: false, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false } }, college: { name: 'JIT', code: 'JIT' }, lastReconcile: null });
    renderWithProviders(<ProvisioningTab />);
    expect(await screen.findByText(/enable juvi in settings to start provisioning/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^new run$/i })).toBeNull();
  });

  it('says no credentials were issued when the run created none', async () => {
    (listRuns as Mock).mockResolvedValue({ items: [{ ...RUN, counts: { ...RUN.counts, created: 0 } }], total: 1, page: 1, pages: 1 });
    (getCredentialGroups as Mock).mockResolvedValue({ expiresAt: RUN.credentialsExpireAt, live: false, groups: [] });
    renderWithProviders(<ProvisioningTab />);
    fireEvent.click(await screen.findByRole('button', { name: /open run/i }));
    expect(await screen.findByText(/no credentials were issued by this run/i)).toBeInTheDocument();
    expect(screen.queryByText(/have expired/i)).toBeNull();
  });

  it('hides New run without platform:create', async () => {
    perm.can = false;
    renderWithProviders(<ProvisioningTab />);
    await screen.findByText(/38 created/i);
    expect(screen.queryByRole('button', { name: /^new run$/i })).toBeNull();
  });
});
