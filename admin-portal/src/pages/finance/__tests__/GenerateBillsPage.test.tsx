/**
 * 007 T13 — GenerateBillsPage. Proves the dry-run → confirm → generate contract and
 * the finance:create gate, without brittle form-fill.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';

import GenerateBillsPage from '../GenerateBillsPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
const confirmMock = vi.hoisted(() => ({ confirmed: true }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { hasPermission: () => boolean }) => unknown) =>
    selector({ hasPermission: () => perm.can }),
}));
vi.mock('../../../services/academics', () => ({ listSemesters: vi.fn() }));
vi.mock('../../../services/finance', () => ({ generateFeeBills: vi.fn() }));
vi.mock('../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve(confirmMock)) }));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

import { listSemesters } from '../../../services/academics';
import { generateFeeBills } from '../../../services/finance';

const RESULT = { dryRun: false, generated: 3, alreadyBilled: 1, noPin: 0, pinnedToDifferentAy: 0, noAmount: 0, unsupportedSemesterNumber: 0, errors: [] };

beforeEach(() => {
  vi.clearAllMocks(); // reset call history so per-test call assertions don't see prior tests' calls
  perm.can = true;
  confirmMock.confirmed = true;
  (listSemesters as Mock).mockResolvedValue({ items: [{ _id: 'sem1', number: 1, year: 2025, status: 'active' }] });
  (generateFeeBills as Mock).mockResolvedValue(RESULT);
});

describe('<GenerateBillsPage />', () => {
  it('previews (dry-run) then generates on confirm', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await screen.findByRole('option', { name: /Semester 1/ });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'sem1' } });
    fireEvent.click(screen.getByRole('button', { name: /Preview & Generate/i }));

    await waitFor(() => expect(generateFeeBills as Mock).toHaveBeenCalledWith({ semesterId: 'sem1', dryRun: true }));
    await waitFor(() => expect(generateFeeBills as Mock).toHaveBeenCalledWith({ semesterId: 'sem1' }));
  });

  it('does not generate when the confirm is dismissed', async () => {
    confirmMock.confirmed = false;
    renderWithProviders(<GenerateBillsPage />);
    await screen.findByRole('option', { name: /Semester 1/ });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'sem1' } });
    fireEvent.click(screen.getByRole('button', { name: /Preview & Generate/i }));

    await waitFor(() => expect(generateFeeBills as Mock).toHaveBeenCalledWith({ semesterId: 'sem1', dryRun: true }));
    const realCalls = (generateFeeBills as Mock).mock.calls.filter((c) => !c[0].dryRun);
    expect(realCalls).toHaveLength(0);
  });

  it('gates on finance:create', async () => {
    perm.can = false;
    renderWithProviders(<GenerateBillsPage />);
    expect(await screen.findByText(/need the finance/i)).toBeInTheDocument();
  });
});
