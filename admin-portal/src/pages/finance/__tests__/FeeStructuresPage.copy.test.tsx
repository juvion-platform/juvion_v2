/**
 * Regression test for the Copy flow on <FeeStructuresPage />.
 *
 * Locks in the contract that clicking the Copy icon on a row prefills
 * the modal with EVERY field of the source row's combination
 * (academicYearId, programmeId, branchId, category, quota, year, plus
 * components) AND that submitting without further edits POSTs the same
 * combination to `createFeeStructure` — i.e. the clone is saved with
 * the same combination as the source.
 *
 * Companion to the unit tests for the openForCopy hook in
 * `admin-portal/src/hooks/__tests__/useViewEditMode.test.ts`.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';

import FeeStructuresPage from '../FeeStructuresPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

// ── Mock the four service modules used by the page ─────────────────────

vi.mock('../../../services/finance', () => ({
  listFeeStructures: vi.fn(),
  createFeeStructure: vi.fn(),
  updateFeeStructure: vi.fn(),
  deleteFeeStructure: vi.fn(),
}));
vi.mock('../../../services/academics', () => ({
  listAcademicYears: vi.fn(),
  listProgrammes: vi.fn(),
  listBranches: vi.fn(),
}));
vi.mock('../../../services/fee-categories', () => ({
  listFeeCategories: vi.fn(),
}));

import {
  listFeeStructures,
  createFeeStructure,
} from '../../../services/finance';
import {
  listAcademicYears,
  listProgrammes,
  listBranches,
} from '../../../services/academics';
import { listFeeCategories } from '../../../services/fee-categories';

const mockedList = listFeeStructures as Mock;
const mockedCreate = createFeeStructure as Mock;
const mockedYears = listAcademicYears as Mock;
const mockedProgrammes = listProgrammes as Mock;
const mockedBranches = listBranches as Mock;
const mockedFeeCategories = listFeeCategories as Mock;

const ACADEMIC_YEAR_ID = '64a000000000000000000001';
const PROGRAMME_ID = '64a000000000000000000002';
const BRANCH_ID = '64a000000000000000000003';

const SOURCE_ROW = {
  _id: '64a0000000000000000000ff',
  academicYearId: { _id: ACADEMIC_YEAR_ID, label: '2025-26', name: '2025-26' },
  programmeId: { _id: PROGRAMME_ID, name: 'B.Tech CSE' },
  branchId: { _id: BRANCH_ID, name: 'CSE' },
  category: 'Tuition',
  quota: 'management',
  year: 2,
  components: [
    { name: 'Tuition Fee', amount: 80000, isRefundable: false },
    { name: 'Lab Fee', amount: 12000, isRefundable: true },
  ],
  totalAmount: 92000,
  status: 'active',
};

beforeEach(() => {
  mockedList.mockReset();
  mockedCreate.mockReset();
  mockedYears.mockReset();
  mockedProgrammes.mockReset();
  mockedBranches.mockReset();
  mockedFeeCategories.mockReset();

  mockedList.mockResolvedValue({ items: [SOURCE_ROW], total: 1, page: 1, pages: 1 });
  mockedYears.mockResolvedValue({
    items: [{ _id: ACADEMIC_YEAR_ID, name: '2025-26', label: '2025-26' }],
    total: 1, page: 1, pages: 1,
  });
  mockedProgrammes.mockResolvedValue({
    items: [{ _id: PROGRAMME_ID, name: 'B.Tech CSE' }],
    total: 1, page: 1, pages: 1,
  });
  mockedBranches.mockResolvedValue({
    items: [{ _id: BRANCH_ID, name: 'CSE' }],
    total: 1, page: 1, pages: 1,
  });
  // Category dropdown is populated from FeeCategory.listForCollege(). The
  // SOURCE_ROW.category is 'Tuition' so the mock must include a row with
  // code='Tuition' for the Copy prefill to land on a real <option>.
  mockedFeeCategories.mockResolvedValue({
    items: [{ _id: 'cat-1', code: 'Tuition', name: 'Tuition', status: 'active' }],
    total: 1, page: 1, pages: 1,
  });
  mockedCreate.mockResolvedValue({ ...SOURCE_ROW, _id: 'new-clone-id' });
});

describe('<FeeStructuresPage /> Copy flow', () => {
  it('clicking Copy prefills the modal with EVERY combination field of the source row', async () => {
    renderWithProviders(<FeeStructuresPage />);

    // Wait for the row to render
    await waitFor(() => expect(screen.getByText('B.Tech CSE')).toBeInTheDocument());

    // Click the Copy icon button on the row
    fireEvent.click(screen.getByTitle('Copy as new'));

    // Modal opens — Component name input is unique to the modal body
    const componentNameInputs = await screen.findAllByPlaceholderText('Component name');
    expect(componentNameInputs).toHaveLength(2);

    // Combination fields are prefilled from the source row.
    // Locate inputs by their adjacent label text + the input pattern in the form.
    const yearInputs = screen.getAllByDisplayValue('2');
    expect(yearInputs.length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Tuition')).toBeInTheDocument();

    // Scan all selects/inputs in the document for the prefilled values
    const allSelects = document.querySelectorAll('select');
    const selectValues = Array.from(allSelects).map((s) => (s as HTMLSelectElement).value);
    expect(selectValues).toContain(ACADEMIC_YEAR_ID);
    expect(selectValues).toContain(PROGRAMME_ID);
    expect(selectValues).toContain(BRANCH_ID);
    expect(selectValues).toContain('management'); // quota

    // Components are prefilled too
    const componentAmountInputs = screen.getAllByPlaceholderText('Amount') as HTMLInputElement[];
    expect((componentNameInputs as HTMLInputElement[]).map((i) => i.value)).toEqual([
      'Tuition Fee',
      'Lab Fee',
    ]);
    expect(componentAmountInputs.map((i) => i.value)).toEqual(['80000', '12000']);
  });

  it('submitting the prefilled clone POSTs the SAME combination to createFeeStructure', async () => {
    renderWithProviders(<FeeStructuresPage />);

    await waitFor(() => expect(screen.getByText('B.Tech CSE')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Copy as new'));
    // Wait for the modal to render — Component name input is modal-only
    await screen.findAllByPlaceholderText('Component name');

    // Submit the form. The footer's Create button has text "Create".
    const createButton = screen.getByRole('button', { name: /^Create$/i });
    fireEvent.click(createButton);

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));

    // The new fee structure carries the source row's full combination
    const payload = mockedCreate.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      academicYearId: ACADEMIC_YEAR_ID,
      programmeId: PROGRAMME_ID,
      branchId: BRANCH_ID,
      category: 'Tuition',
      quota: 'management',
      year: 2,
      totalAmount: 92000,
      components: [
        { name: 'Tuition Fee', amount: 80000, isRefundable: false },
        { name: 'Lab Fee', amount: 12000, isRefundable: true },
      ],
    });

    // No `_id` of the source row leaks into the payload — that would
    // accidentally route through the update path on the server.
    expect(payload).not.toHaveProperty('_id');
  });
});
