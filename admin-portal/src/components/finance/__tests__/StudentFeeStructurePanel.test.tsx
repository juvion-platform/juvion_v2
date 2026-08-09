/**
 * Tests for <StudentFeeStructurePanel />.
 *
 * The panel orchestrates 5 React Queries:
 *   - getStudentPins(studentId)                        → active FSI header
 *   - listStudentFeeAccounts(1, 1, undefined, id)      → the 4 stat pills
 *   - listInvoices(1, 100, undefined, id)              → breakdown rows
 *   - listPayments(1, 200, id)                         → per-invoice paid
 *   - listHolds({ studentId })                         → holds banner
 *
 * We mock all five at the service-module level. Render branches under test:
 *   1. Loading        — queries pending → "Loading…" indicator
 *   2. Empty          — nothing anywhere → empty-state message
 *   3. Happy path     — account + invoices + payments → pills and sorted rows
 *   4. Totals source  — pills read the ACCOUNT, never the invoice rows
 *   5. String FSI id  — header falls back to literal "Fee Structure"
 *   6. Active hold    — pending_approval hold → banner
 *   7. Error fallback — a query rejects → amber banner
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';

import StudentFeeStructurePanel from '../StudentFeeStructurePanel';
import { renderWithProviders } from '../../../__tests__/test-utils';

// ── Mock services ──────────────────────────────────────────────────────
vi.mock('../../../services/finance', () => ({
  listInvoices: vi.fn(),
  listPayments: vi.fn(),
  listStudentFeeAccounts: vi.fn(),
}));
vi.mock('../../../services/fee-configuration', () => ({
  getStudentPins: vi.fn(),
}));
vi.mock('../../../services/fee-holds', () => ({
  listHolds: vi.fn(),
}));

import { listInvoices, listPayments, listStudentFeeAccounts } from '../../../services/finance';
import { getStudentPins } from '../../../services/fee-configuration';
import { listHolds } from '../../../services/fee-holds';

const mockedInvoices = listInvoices as Mock;
const mockedPayments = listPayments as Mock;
const mockedAccounts = listStudentFeeAccounts as Mock;
const mockedPins = getStudentPins as Mock;
const mockedHolds = listHolds as Mock;

/** Every query resolves empty — individual tests override what they care about. */
function resolveAllEmpty() {
  mockedInvoices.mockResolvedValue({ items: [], total: 0 });
  mockedPayments.mockResolvedValue({ items: [], total: 0 });
  mockedAccounts.mockResolvedValue({ items: [], total: 0 });
  mockedPins.mockResolvedValue({ pins: [] });
  mockedHolds.mockResolvedValue({ items: [], total: 0 });
}

const EMPTY_BREAKDOWN = /No bills have been generated for this student yet/;

beforeEach(() => {
  mockedInvoices.mockReset();
  mockedPayments.mockReset();
  mockedAccounts.mockReset();
  mockedPins.mockReset();
  mockedHolds.mockReset();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe('<StudentFeeStructurePanel /> — loading state', () => {
  it('shows the "Loading…" indicator while the queries are in flight', () => {
    const pending = () => new Promise(() => {});
    mockedInvoices.mockReturnValue(pending());
    mockedPayments.mockReturnValue(pending());
    mockedAccounts.mockReturnValue(pending());
    mockedPins.mockReturnValue(pending());
    mockedHolds.mockReturnValue(pending());

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-1" />);

    expect(screen.getByText(/Loading…/)).toBeInTheDocument();
    expect(screen.queryByText(/Could not load fee structure data/)).toBeNull();
  });
});

describe('<StudentFeeStructurePanel /> — empty state', () => {
  it('renders the empty-state message when nothing has been billed', async () => {
    resolveAllEmpty();

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-2" />);

    expect(await screen.findByText(EMPTY_BREAKDOWN)).toBeInTheDocument();
    expect(
      screen.getByText(/No active fee structure pinned yet for this student/),
    ).toBeInTheDocument();
  });
});

describe('<StudentFeeStructurePanel /> — happy path', () => {
  it('renders header, stat pills from the account, and sorted invoice rows', async () => {
    const past = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();

    mockedAccounts.mockResolvedValue({
      items: [{
        _id: 'acct-1',
        totalDue: 120000, totalPaid: 25000, totalWaived: 5000,
        totalRefunded: 0, balance: 90000,
      }],
      total: 1,
    });
    mockedInvoices.mockResolvedValue({
      items: [
        {
          _id: 'inv-2', invoiceNumber: 'INV-B', totalAmount: 60000, netPayable: 60000,
          status: 'generated', dueDate: future, isSemesterInstallment: true,
        },
        {
          _id: 'inv-1', invoiceNumber: 'INV-A', totalAmount: 60000, netPayable: 60000,
          status: 'partially_paid', dueDate: past, isSemesterInstallment: true,
        },
      ],
      total: 2,
    });
    mockedPayments.mockResolvedValue({
      items: [
        { _id: 'pay-1', amount: 25000, status: 'success', invoiceId: 'inv-1' },
        // A failed payment must never count towards an invoice's paid figure.
        { _id: 'pay-2', amount: 9999, status: 'failed', invoiceId: 'inv-1' },
      ],
      total: 2,
    });
    mockedPins.mockResolvedValue({
      pins: [{
        _id: 'pin-1',
        yearOfStudy: 2,
        feeStructureInstanceId: {
          _id: 'fsi-1', name: 'B.Tech CSE 2026 Standard', code: 'CSE-26-STD',
          version: 3, status: 'approved', totalAmount: 120000, quota: 'general',
        },
        pinnedAt: '2026-01-15T00:00:00.000Z', pinnedBy: 'admin-1', reason: 'initial',
      }],
    });
    mockedHolds.mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-3" />);

    expect(await screen.findByText(/Active Fee Structure \(Year 2\)/)).toBeInTheDocument();
    expect(screen.getByText('B.Tech CSE 2026 Standard')).toBeInTheDocument();

    // Pills: billed 1,20,000 / paid 25,000 / waived 5,000 / balance 90,000.
    expect(screen.getAllByText(/₹1,20,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/₹25,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/₹5,000/)).toBeInTheDocument();
    expect(screen.getByText(/₹90,000/)).toBeInTheDocument();

    // Unsettled invoices lead, oldest due first → INV-A above INV-B.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect(within(rows[1] as HTMLElement).getByText(/INV-A/)).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText(/INV-B/)).toBeInTheDocument();

    // INV-A is past due with a balance → shown as Overdue, not "Partial".
    expect(within(rows[1] as HTMLElement).getByText('Overdue')).toBeInTheDocument();
  });

  it('reads the stat pills from the fee account, not from the invoice rows', async () => {
    // The regression this panel had: totals were summed from a collection the
    // billing path never writes, so a billed student showed ₹0 everywhere.
    // With no invoices at all the pills must STILL reflect the account.
    resolveAllEmpty();
    mockedAccounts.mockResolvedValue({
      items: [{
        _id: 'acct-2',
        totalDue: 240000, totalPaid: 0, totalWaived: 0,
        totalRefunded: 0, balance: 240000,
      }],
      total: 1,
    });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-billed" />);

    // findAll* retries: the account query settles independently of the
    // (empty) invoice query, so asserting on the rendered value is what
    // actually waits for it.
    const billed = await screen.findAllByText(/₹2,40,000/);
    expect(billed.length).toBeGreaterThanOrEqual(2); // billed + balance pills
    expect(screen.getByText(EMPTY_BREAKDOWN)).toBeInTheDocument();
  });

  it('uses string fee-structure-instance ID gracefully (header falls back to "Fee Structure")', async () => {
    resolveAllEmpty();
    mockedPins.mockResolvedValue({
      pins: [{
        _id: 'pin-2',
        yearOfStudy: 1,
        feeStructureInstanceId: 'fsi-string-only', // not populated
        pinnedAt: '2026-01-01T00:00:00.000Z', pinnedBy: 'admin-1', reason: 'initial',
      }],
    });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-4" />);

    const headerLabel = await screen.findByText(/Active Fee Structure \(Year 1\)/);
    const card = headerLabel.closest('div.flex.items-start') as HTMLElement | null;
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Fee Structure')).toBeInTheDocument();
  });
});

describe('<StudentFeeStructurePanel /> — active hold banner', () => {
  it('renders the banner when listHolds returns a pending_approval hold', async () => {
    resolveAllEmpty();
    mockedHolds.mockResolvedValue({
      items: [{
        _id: 'h-1', collegeId: 'c1', studentId: 'stu-5',
        holdType: 'transcript_hold', holdStatus: 'pending_approval',
        effectiveDate: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z',
      }],
      total: 1,
    });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-5" />);

    expect(await screen.findByText(/1 active financial hold/)).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText(/transcript hold/i)).toBeInTheDocument();
  });

  it('does not render the banner when only a released hold exists', async () => {
    resolveAllEmpty();
    mockedHolds.mockResolvedValue({
      items: [{
        _id: 'h-2', collegeId: 'c1', studentId: 'stu-6',
        holdType: 'transcript_hold', holdStatus: 'released',
        effectiveDate: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z',
      }],
      total: 1,
    });

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-6" />);

    await screen.findByText(EMPTY_BREAKDOWN);
    expect(screen.queryByText(/active financial hold/)).toBeNull();
  });
});

describe('<StudentFeeStructurePanel /> — error fallback', () => {
  it('shows the amber inline banner when one of the queries rejects', async () => {
    resolveAllEmpty();
    mockedInvoices.mockRejectedValue(new Error('500'));

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-7" />);

    expect(await screen.findByText(/Could not load fee structure data/)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_BREAKDOWN)).toBeNull();
  });
});

describe('<StudentFeeStructurePanel /> — service call wiring', () => {
  it('passes the studentId through to all 5 services', async () => {
    resolveAllEmpty();

    renderWithProviders(<StudentFeeStructurePanel studentId="stu-wire-test" />);

    await waitFor(() => {
      expect(mockedPins).toHaveBeenCalledWith('stu-wire-test');
      expect(mockedAccounts).toHaveBeenCalledWith(1, 1, undefined, 'stu-wire-test');
      expect(mockedInvoices).toHaveBeenCalledWith(1, 100, undefined, 'stu-wire-test');
      expect(mockedPayments).toHaveBeenCalledWith(1, 200, 'stu-wire-test');
      expect(mockedHolds).toHaveBeenCalledWith({ studentId: 'stu-wire-test', limit: 50 });
    });
  });
});
