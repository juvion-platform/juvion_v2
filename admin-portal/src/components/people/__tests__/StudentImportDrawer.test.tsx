import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * StudentImportDrawer — the commit half (final review, Important 4).
 *
 * The drawer used to discard the commit response and fire a fixed "Import
 * committed" toast whatever happened. Per-row commit errors land on the
 * ImportJob, which a Registrar can never read — the facade exposes no job
 * endpoint and they hold people:*, not platform:read — so a 300-row import
 * that half-failed was indistinguishable from a clean one for the only
 * persona this door exists for.
 */

vi.mock('../../../services/student-import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/student-import')>();
  return {
    ...actual,
    getStudentImportTemplate: vi.fn(),
    previewStudentImport: vi.fn(),
    commitStudentImport: vi.fn(),
  };
});
vi.mock('../../../stores/confirmStore', () => ({ confirmAction: vi.fn() }));
vi.mock('../../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import StudentImportDrawer from '../StudentImportDrawer';
import {
  getStudentImportTemplate, previewStudentImport, commitStudentImport,
  type ImportPreview, type ImportCommitSummary,
} from '../../../services/student-import';
import { confirmAction } from '../../../stores/confirmStore';
import { toast } from '../../../stores/toastStore';

const mockedTemplate = getStudentImportTemplate as Mock;
const mockedPreview = previewStudentImport as Mock;
const mockedCommit = commitStudentImport as Mock;
const mockedConfirm = confirmAction as Mock;

const preview: ImportPreview = {
  job: { _id: 'job-1' },
  headers: ['name'],
  previewRows: [
    { row: 1, raw: { name: 'Row One' }, valid: true, errors: [], action: 'create' },
    { row: 2, raw: { name: 'Row Two' }, valid: true, errors: [], action: 'create' },
    { row: 3, raw: { name: 'Row Three' }, valid: true, errors: [], action: 'create' },
  ],
  validCount: 3,
  errorCount: 0,
  actionCounts: { create: 3, update: 0, blocked: 0 },
  sideEffectTotals: {},
};

function renderWith(node: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

/** Drives the drawer from "closed" to "committed". */
async function commitOnce(onClose: () => void) {
  renderWith(<StudentImportDrawer open onClose={onClose} />);
  fireEvent.change(await screen.findByLabelText(/csv file/i), {
    target: { files: [new File(['name\nRow One'], 'students.csv', { type: 'text/csv' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: /^preview$/i }));
  await screen.findByTestId('import-summary');
  fireEvent.click(screen.getByRole('button', { name: /^import 3$/i }));
  await waitFor(() => expect(mockedCommit).toHaveBeenCalledWith('job-1', expect.any(Array)));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedTemplate.mockResolvedValue({
    entityType: 'student', label: 'Students', description: 'x', fields: [], sampleRow: {},
  });
  mockedPreview.mockResolvedValue(preview);
  mockedConfirm.mockResolvedValue({ confirmed: true });
});

describe('<StudentImportDrawer /> commit outcome', () => {
  it('stays open and reports the real counts when rows failed', async () => {
    const summary: ImportCommitSummary = {
      jobId: 'job-1',
      status: 'partial',
      totalRows: 3,
      successCount: 1,
      failureCount: 2,
      blockedCount: 0,
      errorSummary: 'Committed 1 of 3 rows; 2 failed.',
      failedRows: [
        { row: 2, error: 'E11000 duplicate key' },
        { row: 3, error: 'Matched student has no person record' },
      ],
      blockedRows: [],
    };
    mockedCommit.mockResolvedValue(summary);
    const onClose = vi.fn();

    await commitOnce(onClose);

    const panel = await screen.findByTestId('import-result');
    expect(panel).toHaveTextContent('1 imported');
    expect(panel).toHaveTextContent('2 failed');
    expect(panel).toHaveTextContent('E11000 duplicate key');
    expect(panel).toHaveTextContent('Matched student has no person record');
    // Non-celebratory, and the drawer must not vanish before it is read.
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('surfaces blocked rows and their reasons too', async () => {
    mockedCommit.mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      totalRows: 3,
      successCount: 2,
      failureCount: 0,
      blockedCount: 1,
      errorSummary: 'Committed 2 of 3 rows; 1 blocked and not written.',
      failedRows: [],
      blockedRows: [{ row: 3, reason: 'programme change is not allowed on import' }],
    } satisfies ImportCommitSummary);
    const onClose = vi.fn();

    await commitOnce(onClose);

    const panel = await screen.findByTestId('import-result');
    expect(panel).toHaveTextContent('1 blocked');
    expect(panel).toHaveTextContent('programme change is not allowed on import');
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('closes with a success toast naming the count when everything landed', async () => {
    mockedCommit.mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      totalRows: 3,
      successCount: 3,
      failureCount: 0,
      blockedCount: 0,
      failedRows: [],
      blockedRows: [],
    } satisfies ImportCommitSummary);
    const onClose = vi.fn();

    await commitOnce(onClose);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith('Imported 3 students');
    expect(toast.warning).not.toHaveBeenCalled();
    expect(screen.queryByTestId('import-result')).toBeNull();
  });
});

describe('StudentImportDrawer per-row selection UI', () => {
  it('allows selecting/deselecting eligible rows, disables blocked/error checkboxes, updates count, and sends selectedRowNumbers on commit', async () => {
    // 3 rows: Row 1, Row 2 are eligible, Row 3 is blocked
    const previewWithBlocked: ImportPreview = {
      job: { _id: 'job-1' },
      headers: ['name'],
      previewRows: [
        { row: 1, raw: { name: 'Eligible One' }, valid: true, errors: [], action: 'create' },
        { row: 2, raw: { name: 'Eligible Two' }, valid: true, errors: [], action: 'create' },
        { row: 3, raw: { name: 'Blocked Three' }, valid: true, errors: [], action: 'blocked' },
      ],
      validCount: 2,
      errorCount: 0,
      actionCounts: { create: 2, update: 0, blocked: 1 },
      sideEffectTotals: {},
    };

    mockedTemplate.mockResolvedValue({
      entityType: 'student', label: 'Students', description: 'x', fields: [], sampleRow: {},
    });
    // Mock the results field inside job so frontend can find all eligible rows
    (previewWithBlocked.job as any).results = [
      { row: 1, outcome: 'success' },
      { row: 2, outcome: 'success' },
      { row: 3, outcome: 'blocked' },
    ];
    mockedPreview.mockResolvedValue(previewWithBlocked);
    mockedConfirm.mockResolvedValue({ confirmed: true });
    mockedCommit.mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      totalRows: 3,
      successCount: 1,
      failureCount: 0,
      blockedCount: 1,
      skippedCount: 1,
      failedRows: [],
      blockedRows: [{ row: 3, reason: 'blocked' }],
      skippedRows: [{ row: 2, reason: 'skipped' }],
    } satisfies ImportCommitSummary);

    const onClose = vi.fn();
    renderWith(<StudentImportDrawer open onClose={onClose} />);

    // Upload and click preview
    fireEvent.change(await screen.findByLabelText(/csv file/i), {
      target: { files: [new File(['name\nEligible One'], 'students.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /^preview$/i }));

    // Wait for preview to render
    await screen.findByTestId('import-summary');

    // Verify initial select counts
    expect(screen.getByText(/2 of 2 eligible rows selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import 2$/i })).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    const selectAllCheckbox = checkboxes[0] as HTMLInputElement;
    const row1Checkbox = checkboxes[1] as HTMLInputElement;
    const row2Checkbox = checkboxes[2] as HTMLInputElement;
    const row3Checkbox = checkboxes[3] as HTMLInputElement;

    expect(selectAllCheckbox.checked).toBe(true);
    expect(row1Checkbox.checked).toBe(true);
    expect(row2Checkbox.checked).toBe(true);
    expect(row3Checkbox.disabled).toBe(true);

    // Untick Row 2
    fireEvent.click(row2Checkbox);
    expect(row2Checkbox.checked).toBe(false);

    // Count should update to "1 of 2 eligible rows selected"
    expect(screen.getByText(/1 of 2 eligible rows selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import 1$/i })).toBeInTheDocument();

    // Click Import
    fireEvent.click(screen.getByRole('button', { name: /^import 1$/i }));

    // Verify that commitStudentImport was called with selectedRowNumbers array [1]
    await waitFor(() => expect(mockedCommit).toHaveBeenCalledWith('job-1', [1]));
  });
});
