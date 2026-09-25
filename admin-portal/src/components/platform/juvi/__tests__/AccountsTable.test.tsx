import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AccountsTable from '../AccountsTable';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (sel: any) => sel({ hasPermission: () => perm.can }) }));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const confirmMock = vi.hoisted(() => ({ confirmed: true }));
vi.mock('../../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve(confirmMock)) }));
vi.mock('../../../../services/juvi-app', () => ({ listAccounts: vi.fn(), deactivateAccount: vi.fn(), resetAccountPassword: vi.fn(), revealAccountCredential: vi.fn() }));
import { listAccounts, deactivateAccount, resetAccountPassword, revealAccountCredential } from '../../../../services/juvi-app';

const ROW = { id: 'a1', kind: 'student', status: 'onboarding', name: 'Aditya Nair', identifier: '24JIT0001', email: 'a@x.in', onboardingComplete: false, lastSeenAt: null, provisionedAt: '2026-09-23T03:00:00Z', hasLiveCredential: true, credentialExpiresAt: '2026-09-30T03:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks(); perm.can = true; confirmMock.confirmed = true;
  (listAccounts as Mock).mockResolvedValue({ items: [ROW], total: 1, page: 1, pages: 1 });
  (deactivateAccount as Mock).mockResolvedValue({ status: 'deactivated' });
  (resetAccountPassword as Mock).mockResolvedValue({ credentialId: 'c1', expiresAt: '2026-09-30T03:00:00Z' });
  (revealAccountCredential as Mock).mockResolvedValue({ identifier: '24JIT0001', password: 'river-lamp-482', expiresAt: '2026-09-30T03:00:00Z' });
});

describe('AccountsTable', () => {
  it('searches with a debounce-free submit and shows rows', async () => {
    renderWithProviders(<AccountsTable />);
    expect(await screen.findByText('Aditya Nair')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search accounts/i), { target: { value: '24JIT' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(listAccounts).toHaveBeenLastCalledWith(expect.objectContaining({ q: '24JIT', page: 1 })));
  });

  it('reveals a credential on demand and never renders it before the click', async () => {
    renderWithProviders(<AccountsTable />);
    await screen.findByText('Aditya Nair');
    expect(screen.queryByText('river-lamp-482')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /reveal credential for aditya nair/i }));
    expect(await screen.findByText('river-lamp-482')).toBeInTheDocument();
    expect(revealAccountCredential).toHaveBeenCalledWith('a1');
  });

  it('confirms before deactivate and before reset', async () => {
    renderWithProviders(<AccountsTable />);
    await screen.findByText('Aditya Nair');
    fireEvent.click(screen.getByRole('button', { name: /reveal credential for aditya nair/i }));
    expect(await screen.findByText('river-lamp-482')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset password for aditya nair/i }));
    await waitFor(() => expect(resetAccountPassword).toHaveBeenCalledWith('a1'));
    // The old password is no longer valid once reset, so it must not stay on screen.
    await waitFor(() => expect(screen.queryByText('river-lamp-482')).toBeNull());
    confirmMock.confirmed = false;
    fireEvent.click(screen.getByRole('button', { name: /deactivate aditya nair/i }));
    await waitFor(() => expect(deactivateAccount).not.toHaveBeenCalled());
  });
});
