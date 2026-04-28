/**
 * Tests for <BudgetBanner /> (L7b — llm-spend-limits).
 *
 * The banner has three render modes:
 *   1. No signal (no warning + not exceeded)              → renders nothing
 *   2. Warning   (warning ≥ alertThresholdPct, < 100%)     → amber state
 *   3. Exceeded  (warning ≥ 100% OR `exceeded` prop true)  → red state
 *
 * The dismiss button hides the banner for the rest of the session (no
 * persistence — refresh restores it). The relative-time formatter is
 * unit-tested directly because the message uses it.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import BudgetBanner, { formatRelativeFuture } from '../BudgetBanner';

const FUTURE_ISO = (offsetMs: number, base = new Date('2026-04-28T12:00:00Z')) =>
  new Date(base.getTime() + offsetMs).toISOString();

describe('formatRelativeFuture', () => {
  const now = new Date('2026-04-28T12:00:00Z');

  it('handles "in <1 hour" range as minutes', () => {
    expect(formatRelativeFuture(FUTURE_ISO(15 * 60_000, now), now)).toBe('15 minutes');
    // singular
    expect(formatRelativeFuture(FUTURE_ISO(60_000, now), now)).toBe('1 minute');
  });

  it('formats 1-23 hours as hours', () => {
    expect(formatRelativeFuture(FUTURE_ISO(2 * 3_600_000, now), now)).toBe('2 hours');
    expect(formatRelativeFuture(FUTURE_ISO(60 * 60_000, now), now)).toBe('1 hour');
  });

  it('formats >= 24 hours as days', () => {
    expect(formatRelativeFuture(FUTURE_ISO(48 * 3_600_000, now), now)).toBe('2 days');
    expect(formatRelativeFuture(FUTURE_ISO(24 * 3_600_000, now), now)).toBe('1 day');
  });

  it('handles past timestamps gracefully', () => {
    expect(formatRelativeFuture(FUTURE_ISO(-1000, now), now)).toBe('momentarily');
  });

  it('handles invalid ISO gracefully', () => {
    expect(formatRelativeFuture('not-a-date', now)).toBe('soon');
  });
});

describe('<BudgetBanner /> — render modes', () => {
  it('renders nothing when there is no warning and not exceeded', () => {
    const { container } = render(<BudgetBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the amber warning state when warning < 100%', () => {
    render(
      <BudgetBanner
        warning={{
          spent: 850,
          limit: 1000,
          pct: 85,
          resetsAt: FUTURE_ISO(48 * 3_600_000),
        }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.className).toMatch(/border-amber-400/);
    expect(alert.className).toMatch(/bg-amber-50/);
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    // "₹150 remaining" uses the compact formatter (1000 - 850 = 150).
    expect(screen.getByText(/150 remaining/)).toBeInTheDocument();
    expect(screen.getByText(/Resets in/)).toBeInTheDocument();
  });

  it('renders the red exceeded state when pct >= 100', () => {
    render(
      <BudgetBanner
        warning={{
          spent: 1100,
          limit: 1000,
          pct: 110,
          resetsAt: FUTURE_ISO(24 * 3_600_000),
        }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.className).toMatch(/border-red-500/);
    expect(alert.className).toMatch(/bg-red-50/);
    expect(
      screen.getByText(/AI usage exceeded weekly budget/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Contact admin to increase the limit/),
    ).toBeInTheDocument();
  });

  it('renders the red exceeded state when `exceeded` prop is true (no warning)', () => {
    render(<BudgetBanner exceeded />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toMatch(/border-red-500/);
    expect(
      screen.getByText(/AI usage exceeded weekly budget/),
    ).toBeInTheDocument();
  });

  it('hides the banner when the dismiss button is clicked', () => {
    render(
      <BudgetBanner
        warning={{
          spent: 800,
          limit: 1000,
          pct: 80,
          resetsAt: FUTURE_ISO(48 * 3_600_000),
        }}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Dismiss budget notice/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
