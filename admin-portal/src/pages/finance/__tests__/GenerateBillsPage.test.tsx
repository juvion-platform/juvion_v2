/**
 * GenerateBillsPage — the billing console.
 *
 * Replaces the old dry-run → counts-dialog → generate tests: that dialog is
 * gone, and with it the flow they asserted. What matters now is that the table
 * names its subjects and that the two ways to bill the wrong people are closed:
 *
 *  - Generate posts `studentIds` and NOTHING else. The backend still applies its
 *    yearOfStudy filter on top of an explicit list, so sending the filters too
 *    would silently drop ticked students.
 *  - Changing a filter clears the table, or you would bill a cohort you are no
 *    longer looking at.
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
vi.mock('../../../services/academics', () => ({
  listSemesters: vi.fn(), listProgrammes: vi.fn(), listBranches: vi.fn(),
}));
vi.mock('../../../services/finance', () => ({ generateFeeBills: vi.fn(), getBillingHistory: vi.fn() }));
vi.mock('../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve(confirmMock)) }));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { listSemesters, listProgrammes, listBranches } from '../../../services/academics';
import { generateFeeBills, getBillingHistory } from '../../../services/finance';

const ROWS = [
  { studentId: 's1', name: 'Aditya Nair', rollNumber: '25B01A0511', programmeCode: 'BTECH', branchCode: 'CSE', yearOfStudy: 1, amount: 60000, outcome: 'generated' },
  { studentId: 's2', name: 'Kavya Menon', rollNumber: '25B01A0512', programmeCode: 'BTECH', branchCode: 'CSE', yearOfStudy: 1, amount: 60000, outcome: 'generated' },
  { studentId: 's3', name: 'Rohit Verma', rollNumber: '25B01A0513', programmeCode: 'BTECH', branchCode: 'CSE', yearOfStudy: 1, amount: 0, outcome: 'already-billed' },
  { studentId: 's4', name: 'Meera Krishnan', rollNumber: '25B01A0411', programmeCode: 'BTECH', branchCode: 'ECE', yearOfStudy: 0, amount: 0, outcome: 'no-active-pin' },
];

const HISTORY = [
  { semesterId: 'sem1', semesterLabel: 'Semester 1 — 2025', invoiceCount: 12, totalBilled: 720000, firstGeneratedAt: '2026-08-03T10:00:00.000Z', lastGeneratedAt: '2026-08-03T10:00:00.000Z', pinnedStudents: 15 },
];

const PREVIEW = {
  dryRun: true, generated: 2, alreadyBilled: 1, noPin: 1, pinnedToDifferentAy: 0,
  noAmount: 0, unsupportedSemesterNumber: 0, errors: [], rows: ROWS, totalAmount: 120000,
};

/** Pick the semester, then Preview — the entry point for every table test. */
async function previewWith(semester = 'sem1') {
  await screen.findByRole('option', { name: /Semester 1/ });
  fireEvent.change(screen.getByLabelText(/Semester \*/), { target: { value: semester } });
  fireEvent.click(screen.getByRole('button', { name: /^Preview$/i }));
  await screen.findByText('Aditya Nair');
}

beforeEach(() => {
  vi.clearAllMocks();
  perm.can = true;
  confirmMock.confirmed = true;
  (listSemesters as Mock).mockResolvedValue({ items: [{ _id: 'sem1', number: 1, year: 2025, status: 'active' }] });
  (listProgrammes as Mock).mockResolvedValue({ items: [{ _id: 'p1', code: 'BTECH', name: 'B.Tech' }] });
  (listBranches as Mock).mockResolvedValue({ items: [{ _id: 'b1', code: 'CSE' }] });
  (generateFeeBills as Mock).mockResolvedValue(PREVIEW);
  (getBillingHistory as Mock).mockResolvedValue(HISTORY);
});

describe('<GenerateBillsPage /> — preview table', () => {
  it('names every student in scope, billable or not', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    expect(generateFeeBills as Mock).toHaveBeenCalledWith({ semesterId: 'sem1', dryRun: true });
    for (const name of ['Aditya Nair', 'Kavya Menon', 'Rohit Verma', 'Meera Krishnan']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText('Already billed')).toBeInTheDocument();
    expect(screen.getByText('No pin')).toBeInTheDocument();
  });

  it('disables the checkbox on every non-billable row', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    expect(screen.getByLabelText('Select Aditya Nair')).toBeEnabled();
    expect(screen.getByLabelText('Select Rohit Verma')).toBeDisabled();
    expect(screen.getByLabelText('Select Meera Krishnan')).toBeDisabled();
  });

  it('offers a Fix link only on the no-pin row', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    const links = screen.getAllByRole('link', { name: /Fix/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/finance/fee-management/pin-coverage');
  });

  it('seeds the selection with the billable rows and totals them', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    expect(screen.getByTestId('selected-count')).toHaveTextContent('2');
    expect(screen.getByTestId('selected-total')).toHaveTextContent('₹1,20,000');
  });

  it('drops the total as rows are unticked — never trusting the server figure', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    // The response says totalAmount 1,20,000. Once a row is unticked the footer
    // must disagree with it — that is the whole point of summing client-side.
    fireEvent.click(screen.getByLabelText('Select Aditya Nair'));

    await waitFor(() => expect(screen.getByTestId('selected-total')).toHaveTextContent('₹60,000'));
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
  });

  it('filters the visible rows by search without refetching', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    fireEvent.change(screen.getByLabelText(/Search students/), { target: { value: 'kavya' } });
    await waitFor(() => expect(screen.queryByText('Aditya Nair')).toBeNull());
    expect(screen.getByText('Kavya Menon')).toBeInTheDocument();
    expect(generateFeeBills as Mock).toHaveBeenCalledTimes(1); // search is client-side
  });
});

describe('<GenerateBillsPage /> — generating', () => {
  it('posts ONLY the ticked studentIds, never the filters', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    // A year filter is deliberately set: the backend would re-apply it on top of
    // an explicit id list and silently drop ticked rows, so it must not be sent.
    fireEvent.change(screen.getByLabelText(/Year of study/), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Preview$/i }));
    await screen.findByText('Aditya Nair');

    fireEvent.click(screen.getByLabelText('Select Aditya Nair')); // untick one
    fireEvent.click(screen.getByRole('button', { name: /Generate bills/i }));

    await waitFor(() => {
      const real = (generateFeeBills as Mock).mock.calls.filter((c) => !c[0].dryRun);
      expect(real).toHaveLength(1);
      expect(real[0]![0]).toEqual({ semesterId: 'sem1', studentIds: ['s2'] });
    });
  });

  it('does not generate when the confirm is dismissed', async () => {
    confirmMock.confirmed = false;
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    fireEvent.click(screen.getByRole('button', { name: /Generate bills/i }));

    await waitFor(() => {
      expect((generateFeeBills as Mock).mock.calls.filter((c) => !c[0].dryRun)).toHaveLength(0);
    });
  });

  it('disables Generate once nothing is selected — the mass-bill guard', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    fireEvent.click(screen.getByLabelText('Select Aditya Nair'));
    fireEvent.click(screen.getByLabelText('Select Kavya Menon'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Generate bills/i })).toBeDisabled());
  });
});

describe('<GenerateBillsPage /> — staleness and gating', () => {
  it('clears the table when a filter changes, so a stale cohort cannot be billed', async () => {
    renderWithProviders(<GenerateBillsPage />);
    await previewWith();

    fireEvent.change(screen.getByLabelText(/Programme/), { target: { value: 'p1' } });

    await waitFor(() => expect(screen.queryByText('Aditya Nair')).toBeNull());
    expect(screen.queryByRole('button', { name: /Generate bills/i })).toBeNull();
  });

  it('distinguishes "nothing matched" from "all already billed" in the empty state', async () => {
    (generateFeeBills as Mock).mockResolvedValue({ ...PREVIEW, rows: [], generated: 0, totalAmount: 0 });
    renderWithProviders(<GenerateBillsPage />);
    await screen.findByRole('option', { name: /Semester 1/ });
    fireEvent.change(screen.getByLabelText(/Semester \*/), { target: { value: 'sem1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Preview$/i }));

    expect(await screen.findByText(/No pinned students match these filters/)).toBeInTheDocument();
  });

  it('gates on finance:create', async () => {
    perm.can = false;
    renderWithProviders(<GenerateBillsPage />);
    expect(await screen.findByText(/need the finance/i)).toBeInTheDocument();
  });
});

describe('<GenerateBillsPage /> — billing history', () => {
  it('lists what was billed per semester, and links into Invoices', async () => {
    renderWithProviders(<GenerateBillsPage />);

    expect(await screen.findByText('Semester 1 — 2025')).toBeInTheDocument();
    expect(screen.getByText('₹7,20,000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View invoices/ }))
      .toHaveAttribute('href', '/finance/fee-management/invoices?semesterId=sem1');
  });

  it('shows history without needing a preview first', async () => {
    renderWithProviders(<GenerateBillsPage />);

    await screen.findByText('Semester 1 — 2025');
    // It reads existing invoices, so it stands alone from the preview flow.
    expect(generateFeeBills as Mock).not.toHaveBeenCalled();
  });

  it('reports nothing billed rather than an empty table', async () => {
    (getBillingHistory as Mock).mockResolvedValue([]);
    renderWithProviders(<GenerateBillsPage />);

    expect(await screen.findByText(/No bills have been generated yet/)).toBeInTheDocument();
  });
});

describe('<GenerateBillsPage /> — history coverage', () => {
  it('shows how many of the billable population were billed, and what is left', async () => {
    renderWithProviders(<GenerateBillsPage />);

    expect(await screen.findByText('12 of 15')).toBeInTheDocument();
    expect(screen.getByText('3 left')).toBeInTheDocument();
  });

  it('marks a semester Complete once everyone billable has been billed', async () => {
    (getBillingHistory as Mock).mockResolvedValue([{ ...HISTORY[0], invoiceCount: 15, pinnedStudents: 15 }]);
    renderWithProviders(<GenerateBillsPage />);

    expect(await screen.findByText('Complete')).toBeInTheDocument();
  });

  it('falls back to a bare count when the billable population is unknown', async () => {
    (getBillingHistory as Mock).mockResolvedValue([{ ...HISTORY[0], pinnedStudents: 0 }]);
    renderWithProviders(<GenerateBillsPage />);

    await screen.findByText('Semester 1 — 2025');
    expect(screen.queryByText(/left$/)).toBeNull();
    expect(screen.queryByText('Complete')).toBeNull();
  });
});
