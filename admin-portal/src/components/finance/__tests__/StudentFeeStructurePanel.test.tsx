/**
 * Tests for <StudentFeeStructurePanel />.
 *
 * The panel orchestrates 3 React Queries:
 *   - getStudentPins(studentId)
 *   - listFeeLineItems(1, 100, studentId)
 *   - listHolds({ studentId })
 *
 * We mock all three at the service-module level. Render branches under
 * test:
 *   1. Loading        — all 3 queries pending → "Loading…" indicator
 *   2. Empty          — pins, items, holds all empty → empty-state message
 *   3. Happy path     — items + active pin → header + 4 stat pills + table
 *   4. Active hold    — listHolds returns a pending_approval hold → banner
 *   5. Error fallback — at least one query rejects → amber banner shown
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';

import StudentFeeStructurePanel from '../StudentFeeStructurePanel';
import { renderWithProviders } from '../../../__tests__/test-utils';

// ── Mock services ──────────────────────────────────────────────────────
vi.mock('../../../services/finance', () => ({
  listFeeLineItems: vi.fn(),
}));
vi.mock('../../../services/fee-configuration', () => ({
  getStudentPins: vi.fn(),
}));
vi.mock('../../../services/fee-holds', () => ({
  listHolds: vi.fn(),
}));

import { listFeeLineItems } from '../../../services/finance';
import { getStudentPins } from '../../../services/fee-configuration';
import { listHolds } from '../../../services/fee-holds';

const mockedLineItems = listFeeLineItems as Mock;
const mockedPins = getStudentPins as Mock;
const mockedHolds = listHolds as Mock;

beforeEach(() => {
  mockedLineItems.mockReset();
  mockedPins.mockReset();
  mockedHolds.mockReset();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe('<StudentFeeStructurePanel /> — loading state', () => {
  it('shows the "Loading…" indicator while all 3 queries are in flight', () => {
    mockedLineItems.mockReturnValue(new Promise(() => {}));
    mockedPins.mockReturnValue(new Promise(() => {}));
    mockedHolds.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-1" />);

    expect(screen.getByText(/Loading…/)).toBeInTheDocument();
    // The amber error banner should NOT show during loading.
    expect(screen.queryByText(/Could not load fee structure data/)).toBeNull();
  });
});

describe('<StudentFeeStructurePanel /> — empty state', () => {
  it('renders the empty-state message when no line items, pins, or holds exist', async () => {
    mockedLineItems.mockResolvedValue({ items: [], total: 0 });
    mockedPins.mockResolvedValue({ pins: [] });
    mockedHolds.mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-2" />);

    expect(
      await screen.findByText(/No fee line items have been generated for this student yet/),
    ).toBeInTheDocument();
    // The "no active fee structure" placeholder is shown too.
    expect(
      screen.getByText(/No active fee structure pinned yet for this student/),
    ).toBeInTheDocument();
  });
});

describe('<StudentFeeStructurePanel /> — happy path with line items', () => {
  it('renders header, stat pills with correct totals, and sorted breakdown rows', async () => {
    mockedLineItems.mockResolvedValue({
      items: [
        {
          _id: 'li-1',
          component: 'Tuition',
          semester: 1,
          amount: 50000,
          paidAmount: 50000,
          waivedAmount: 0,
          status: 'paid',
        },
        {
          _id: 'li-2',
          component: 'Library',
          semester: 1,
          amount: 2000,
          paidAmount: 0,
          waivedAmount: 0,
          status: 'overdue',
        },
        {
          _id: 'li-3',
          component: 'Transport',
          semester: 2,
          amount: 8000,
          paidAmount: 4000,
          waivedAmount: 0,
          status: 'partial',
        },
      ],
      total: 3,
    });
    mockedPins.mockResolvedValue({
      pins: [
        {
          _id: 'pin-1',
          yearOfStudy: 2,
          feeStructureInstanceId: {
            _id: 'fsi-1',
            name: 'B.Tech CSE 2026 Standard',
            code: 'CSE-26-STD',
            version: 3,
            status: 'approved',
            totalAmount: 60000,
            quota: 'general',
          },
          pinnedAt: '2026-01-15T00:00:00.000Z',
          pinnedBy: 'admin-1',
          reason: 'initial',
        },
      ],
    });
    mockedHolds.mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-3" />);

    // Active fee structure header
    expect(await screen.findByText(/Active Fee Structure \(Year 2\)/)).toBeInTheDocument();
    expect(screen.getByText('B.Tech CSE 2026 Standard')).toBeInTheDocument();

    // Totals: billed 60k, paid 54k, waived 0, balance 6k.
    // Use Indian-locale formatting (\u20B960,000 etc).
    expect(screen.getAllByText(/₹60,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/₹54,000/)).toBeInTheDocument();
    expect(screen.getByText(/₹6,000/)).toBeInTheDocument();

    // Breakdown rows (sorted: overdue first, then partial, then paid).
    const rows = screen.getAllByRole('row');
    // First row is the table header, then 3 data rows.
    expect(rows).toHaveLength(4);
    expect(within(rows[1] as HTMLElement).getByText('Library')).toBeInTheDocument();    // overdue
    expect(within(rows[2] as HTMLElement).getByText('Transport')).toBeInTheDocument();  // partial
    expect(within(rows[3] as HTMLElement).getByText('Tuition')).toBeInTheDocument();    // paid
  });

  it('uses string fee-structure-instance ID gracefully (header falls back to "Fee Structure")', async () => {
    mockedLineItems.mockResolvedValue({ items: [], total: 0 });
    mockedPins.mockResolvedValue({
      pins: [
        {
          _id: 'pin-2',
          yearOfStudy: 1,
          feeStructureInstanceId: 'fsi-string-only', // not populated
          pinnedAt: '2026-01-01T00:00:00.000Z',
          pinnedBy: 'admin-1',
          reason: 'initial',
        },
      ],
    });
    mockedHolds.mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-4" />);

    // The heading "Active Fee Structure (Year 1)" appears once we have a pin;
    // its sibling truncated <div> shows the FSI display name. With the
    // feeStructureInstanceId being a bare string ID, the component falls
    // back to literal "Fee Structure".
    const headerLabel = await screen.findByText(/Active Fee Structure \(Year 1\)/);
    const card = headerLabel.closest('div.flex.items-start') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Fee Structure')).toBeInTheDocument();
  });
});

describe('<StudentFeeStructurePanel /> — active hold banner', () => {
  it('renders the rose-tinted active-holds banner when listHolds returns a pending_approval hold', async () => {
    mockedLineItems.mockResolvedValue({ items: [], total: 0 });
    mockedPins.mockResolvedValue({ pins: [] });
    mockedHolds.mockResolvedValue({
      items: [
        {
          _id: 'h-1',
          collegeId: 'c1',
          studentId: 'stu-5',
          holdType: 'transcript_hold',
          holdStatus: 'pending_approval',
          effectiveDate: '2026-04-01T00:00:00.000Z',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      total: 1,
    });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-5" />);

    expect(await screen.findByText(/1 active financial hold/)).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    // Pretty-printed hold type
    expect(screen.getByText(/transcript hold/i)).toBeInTheDocument();
  });

  it('does not render the banner when only a released hold exists', async () => {
    mockedLineItems.mockResolvedValue({ items: [], total: 0 });
    mockedPins.mockResolvedValue({ pins: [] });
    mockedHolds.mockResolvedValue({
      items: [
        {
          _id: 'h-2',
          collegeId: 'c1',
          studentId: 'stu-6',
          holdType: 'transcript_hold',
          holdStatus: 'released',
          effectiveDate: '2026-04-01T00:00:00.000Z',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      total: 1,
    });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-6" />);

    // Wait for the empty-state to render so we know all 3 queries settled.
    await screen.findByText(/No fee line items have been generated for this student yet/);
    expect(screen.queryByText(/active financial hold/)).toBeNull();
  });
});

describe('<StudentFeeStructurePanel /> — error fallback', () => {
  it('shows the amber inline banner when one of the queries rejects', async () => {
    mockedLineItems.mockRejectedValue(new Error('500'));
    mockedPins.mockResolvedValue({ pins: [] });
    mockedHolds.mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-7" />);

    expect(
      await screen.findByText(/Could not load fee structure data/),
    ).toBeInTheDocument();
    // Fee structure / breakdown should NOT render alongside the error banner.
    expect(screen.queryByText(/No fee line items have been generated for this student yet/)).toBeNull();
  });
});

describe('<StudentFeeStructurePanel /> — service call wiring', () => {
  it('passes the studentId through to all 3 services', async () => {
    mockedLineItems.mockResolvedValue({ items: [], total: 0 });
    mockedPins.mockResolvedValue({ pins: [] });
    mockedHolds.mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-wire-test" />);

    await waitFor(() => {
      expect(mockedPins).toHaveBeenCalledWith('stu-wire-test');
      expect(mockedLineItems).toHaveBeenCalledWith(1, 100, 'stu-wire-test');
      expect(mockedHolds).toHaveBeenCalledWith({ studentId: 'stu-wire-test', limit: 50 });
    });
  });
});
