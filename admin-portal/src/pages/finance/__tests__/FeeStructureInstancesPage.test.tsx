/**
 * Tests for the FSI authoring page (Fix 1).
 *
 * Focus on the contracts that matter and don't depend on brittle
 * form-fill: the list renders with status, create is permission-gated,
 * and lifecycle actions are wired + permission-gated. The create/edit
 * two-step write path is covered by the backend service tests.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';

import FeeStructureInstancesPage from '../FeeStructureInstancesPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ canWrite: true }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { hasPermission: () => boolean }) => unknown) =>
    selector({ hasPermission: () => perm.canWrite }),
}));

vi.mock('../../../services/fee-configuration', () => ({
  listFeeStructureInstances: vi.fn(),
  createFeeStructureInstance: vi.fn(),
  updateFeeStructureInstance: vi.fn(),
  deleteFeeStructureInstance: vi.fn(),
  submitFeeStructureInstance: vi.fn(),
  approveFeeStructureInstance: vi.fn(),
  activateFeeStructureInstance: vi.fn(),
  rejectFeeStructureInstance: vi.fn(),
  archiveFeeStructureInstance: vi.fn(),
  listFeeComponents: vi.fn(),
  createFeeComponent: vi.fn(),
  updateFeeComponent: vi.fn(),
  deleteFeeComponent: vi.fn(),
  previewMatchingFeeStructure: vi.fn(),
}));
vi.mock('../../../services/academics', () => ({
  listAcademicYears: vi.fn(),
  listProgrammes: vi.fn(),
  listBranches: vi.fn(),
}));
vi.mock('../../../services/fee-categories', () => ({ listFeeCategories: vi.fn() }));
vi.mock('../../../services/fee-quotas', () => ({ listFeeQuotas: vi.fn() }));

import {
  listFeeStructureInstances,
  approveFeeStructureInstance,
  listFeeComponents,
  previewMatchingFeeStructure,
} from '../../../services/fee-configuration';
import { listAcademicYears, listProgrammes, listBranches } from '../../../services/academics';
import { listFeeCategories } from '../../../services/fee-categories';
import { listFeeQuotas } from '../../../services/fee-quotas';

const PROG = { _id: 'p1', name: 'B.Tech CSE' };
const AY = { _id: 'ay1', name: '2025-26' };

function row(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'fsi1',
    programmeId: PROG,
    branchId: null,
    academicYearId: AY,
    quota: 'convener',
    category: 'OC',
    yearOfStudy: 1,
    totalAmount: 50000,
    status: 'draft',
    ...overrides,
  };
}

beforeEach(() => {
  perm.canWrite = true;
  (listAcademicYears as Mock).mockResolvedValue({ items: [AY] });
  (listProgrammes as Mock).mockResolvedValue({ items: [PROG] });
  (listBranches as Mock).mockResolvedValue({ items: [] });
  (listFeeCategories as Mock).mockResolvedValue({ items: [{ _id: 'c1', code: 'OC', name: 'OC' }] });
  (listFeeQuotas as Mock).mockResolvedValue({ items: [{ _id: 'q1', code: 'convener', name: 'Convener', status: 'active' }] });
  (listFeeComponents as Mock).mockResolvedValue({ items: [] });
  (previewMatchingFeeStructure as Mock).mockResolvedValue({ matched: false, fsi: null, academicYearId: null });
  (approveFeeStructureInstance as Mock).mockResolvedValue({ ...row(), status: 'approved' });
  (listFeeStructureInstances as Mock).mockResolvedValue({ items: [row()], total: 1, page: 1, pages: 1 });
});

describe('<FeeStructureInstancesPage />', () => {
  it('renders rows with the status badge', async () => {
    renderWithProviders(<FeeStructureInstancesPage />);
    const progCell = await screen.findByText('B.Tech CSE');
    // Scope to the row so we don't match the status-filter <option value="draft">.
    const rowEl = progCell.closest('tr');
    expect(rowEl).not.toBeNull();
    expect(within(rowEl as HTMLElement).getByText('draft')).toBeInTheDocument();
  });

  it('shows the create button when the user has finance:update', async () => {
    renderWithProviders(<FeeStructureInstancesPage />);
    expect(await screen.findByText('B.Tech CSE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Fee Structure/i })).toBeInTheDocument();
  });

  it('hides the create button when the user lacks finance:update', async () => {
    perm.canWrite = false;
    renderWithProviders(<FeeStructureInstancesPage />);
    expect(await screen.findByText('B.Tech CSE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Fee Structure/i })).not.toBeInTheDocument();
  });

  it('opens the create modal with a "Create draft" action', async () => {
    renderWithProviders(<FeeStructureInstancesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /New Fee Structure/i }));
    expect(await screen.findByRole('button', { name: /Create draft/i })).toBeInTheDocument();
  });

  it('offers Approve when viewing a submitted FSI and calls the lifecycle service', async () => {
    (listFeeStructureInstances as Mock).mockResolvedValue({ items: [row({ status: 'submitted' })], total: 1, page: 1, pages: 1 });
    renderWithProviders(<FeeStructureInstancesPage />);
    fireEvent.click(await screen.findByTitle('View / actions'));

    const approve = await screen.findByRole('button', { name: /^Approve$/i });
    fireEvent.click(approve);
    await waitFor(() => expect(approveFeeStructureInstance as Mock).toHaveBeenCalledWith('fsi1'));
  });

  it('does not render lifecycle actions when the user lacks finance:update', async () => {
    perm.canWrite = false;
    (listFeeStructureInstances as Mock).mockResolvedValue({ items: [row({ status: 'submitted' })], total: 1, page: 1, pages: 1 });
    renderWithProviders(<FeeStructureInstancesPage />);
    fireEvent.click(await screen.findByTitle('View / actions'));
    // The modal opens (its "Fee Components" section renders) but no Approve action.
    expect(await screen.findByText('Fee Components')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument();
  });
});
