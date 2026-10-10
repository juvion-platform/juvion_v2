import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen } from '@testing-library/react';
import DeletionsTab, { deletionAge } from '../DeletionsTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

vi.mock('../../../../services/juvi-app', () => ({ listPendingDeletions: vi.fn() }));
import { listPendingDeletions } from '../../../../services/juvi-app';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// The grace window the server reports; the page must not hardcode 7 (011 T13 returns it
// precisely so the portal never has to).
const GRACE = 7;

beforeEach(() => {
  vi.clearAllMocks();
  (listPendingDeletions as Mock).mockResolvedValue({ graceDays: GRACE, items: [] });
});

describe('deletionAge', () => {
  it('marks the deadline itself as past grace, matching the sweep', () => {
    // The sweep is `deletionRequestedAt <= now - grace` (deletion-sweep-worker.ts:41), i.e. age >=
    // grace. One millisecond either side of that boundary decides whether the table tells an
    // operator the sweep is stalled, so the boundary is pinned here rather than inferred.
    const now = Date.parse('2026-10-10T12:00:00.000Z');
    const at = (offsetMs: number) => new Date(now - GRACE * DAY + offsetMs).toISOString();
    expect(deletionAge(at(0), GRACE, now)).toEqual({ days: 7, overdue: true });
    expect(deletionAge(at(1), GRACE, now)).toEqual({ days: 6, overdue: false });
  });
});

describe('DeletionsTab', () => {
  it('lists pending deletions and separates past-grace from within-grace by age', async () => {
    (listPendingDeletions as Mock).mockResolvedValue({
      graceDays: GRACE,
      items: [
        { id: 'd1', requestedAt: ago(10), requestedVia: 'public_web', claimedAt: null },
        // Claimed by a sweep that then died: a non-null claim does **not** mean it ran, so this row
        // must still read as overdue. Keying on "claim is null" is the mislabel AC5 forbids.
        { id: 'd2', requestedAt: ago(9), requestedVia: null, claimedAt: ago(2) },
        { id: 'd3', requestedAt: ago(1), requestedVia: null, claimedAt: null },
      ],
    });
    renderWithProviders(<DeletionsTab />);

    expect(await screen.findByText('d1')).toBeInTheDocument();
    expect(screen.getByText('d2')).toBeInTheDocument();
    expect(screen.getByText('d3')).toBeInTheDocument();

    // Age is the whole detection rule; it has to be readable, not just present as a date.
    expect(screen.getByText('10 days')).toBeInTheDocument();
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.getAllByText(/past grace/i)).toHaveLength(2);
    expect(screen.getAllByText(/within grace/i)).toHaveLength(1);

    // The way the request arrived is the one thing the deletion trail records, so it is shown.
    expect(screen.getByText(/public web form/i)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is pending', async () => {
    renderWithProviders(<DeletionsTab />);
    expect(await screen.findByText(/no deletions are pending/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('states the grace window it was given, not a hardcoded one', async () => {
    (listPendingDeletions as Mock).mockResolvedValue({ graceDays: 3, items: [] });
    renderWithProviders(<DeletionsTab />);
    expect(await screen.findByText(/3 days after the request/i)).toBeInTheDocument();
    expect(screen.queryByText(/7 days after the request/i)).toBeNull();
  });
});
