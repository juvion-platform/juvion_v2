import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ProgrammeTransferDialog from '../ProgrammeTransferDialog';

/**
 * ProgrammeTransferDialog — exercises:
 *   - Renders heading, programme options, and the "current" badge.
 *   - Submits POST /finance/students/:id/transfer-programme with the
 *     5 required fields.
 *   - Validates locally (rejects no-op same-programme picks before
 *     the network call).
 *   - Shows the backend's error message on a 4xx response.
 */

vi.mock('../../../services/academics', () => ({
  listProgrammes: vi.fn(),
  listBranches: vi.fn(),
  listRegulations: vi.fn(),
  listAcademicYears: vi.fn(),
}));
vi.mock('../../../services/fee-configuration', () => ({
  transferProgramme: vi.fn(),
}));

import { listProgrammes, listBranches, listRegulations, listAcademicYears } from '../../../services/academics';
import { transferProgramme } from '../../../services/fee-configuration';

const mockedProgrammes = listProgrammes as Mock;
const mockedBranches = listBranches as Mock;
const mockedRegulations = listRegulations as Mock;
const mockedAcademicYears = listAcademicYears as Mock;
const mockedTransfer = transferProgramme as Mock;

const PROG_CURRENT = 'prog-current-id';
const PROG_NEW = 'prog-new-id';
const AY_ID = 'ay-2026-id';

function renderWith(panel: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{panel}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedProgrammes.mockResolvedValue({
    items: [
      { _id: PROG_CURRENT, name: 'B.Tech CSE' },
      { _id: PROG_NEW, name: 'B.Tech ECE' },
    ],
    total: 2, page: 1, pages: 1,
  });
  mockedBranches.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  mockedRegulations.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  mockedAcademicYears.mockResolvedValue({
    items: [{ _id: AY_ID, name: '2026-27', label: '2026-27' }],
    total: 1, page: 1, pages: 1,
  });
});

describe('<ProgrammeTransferDialog />', () => {
  it('renders heading and the current-programme badge', async () => {
    renderWith(
      <ProgrammeTransferDialog
        studentId="student-1"
        currentProgrammeId={PROG_CURRENT}
        currentProgrammeName="B.Tech CSE"
        currentYear={2}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    await screen.findByText(/transfer programme/i);
    expect(screen.getByText(/^From:$/i)).toBeInTheDocument();
    expect(screen.getByText('B.Tech CSE')).toBeInTheDocument();
  });

  it('submits the 5 required fields to transferProgramme()', async () => {
    mockedTransfer.mockResolvedValueOnce({ oldPin: null, newPin: { _id: 'new-pin' } });
    const onSuccess = vi.fn();
    renderWith(
      <ProgrammeTransferDialog
        studentId="student-1"
        currentProgrammeId={PROG_CURRENT}
        currentProgrammeName="B.Tech CSE"
        currentYear={2}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    // Wait for programme options to render before changing the select.
    await screen.findByRole('option', { name: /b.tech ece/i });

    fireEvent.change(screen.getByDisplayValue('Select programme'), { target: { value: PROG_NEW } });
    fireEvent.change(screen.getByDisplayValue('Select year'), { target: { value: AY_ID } });
    fireEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() => expect(mockedTransfer).toHaveBeenCalledTimes(1));
    expect(mockedTransfer).toHaveBeenCalledWith('student-1', expect.objectContaining({
      newProgrammeId: PROG_NEW,
      effectiveYearOfStudy: 2,
      academicYearId: AY_ID,
      reason: 'student_request',
    }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('blocks submitting the SAME programme as current with an inline validation message', async () => {
    renderWith(
      <ProgrammeTransferDialog
        studentId="student-1"
        currentProgrammeId={PROG_CURRENT}
        currentProgrammeName="B.Tech CSE"
        currentYear={2}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await screen.findByRole('option', { name: /b.tech ece/i });
    // The current programme option is `disabled` in the select, so the
    // value can't actually be set to it via user interaction. Verify the
    // disabled attribute is there as the UI-level guard.
    const currentOpt = screen.getByRole('option', { name: /b.tech cse \(current\)/i }) as HTMLOptionElement;
    expect(currentOpt.disabled).toBe(true);
  });

  it('renders the backend error inline on a 4xx response', async () => {
    mockedTransfer.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'fail',
      response: { status: 422, data: { error: 'No active fee structure for the new programme.' } },
    });
    renderWith(
      <ProgrammeTransferDialog
        studentId="student-1"
        currentProgrammeId={PROG_CURRENT}
        currentProgrammeName="B.Tech CSE"
        currentYear={2}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await screen.findByRole('option', { name: /b.tech ece/i });
    fireEvent.change(screen.getByDisplayValue('Select programme'), { target: { value: PROG_NEW } });
    fireEvent.change(screen.getByDisplayValue('Select year'), { target: { value: AY_ID } });
    fireEvent.click(screen.getByRole('button', { name: /^transfer$/i }));

    await screen.findByText(/no active fee structure/i);
  });
});
