import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import LeadGradeBadge from '../LeadGradeBadge';

/**
 * 001-ai-lead-scoring — Task 5.2
 * Compact badge that renders the lead grade + the numeric score together.
 * Color encodes urgency: hot=red, warm=orange, cold=gray, dormant=slate.
 */

describe('<LeadGradeBadge />', () => {
  it('renders hot grade with red palette and score', () => {
    const { container } = render(<LeadGradeBadge grade="hot" score={92} />);
    expect(screen.getByText('hot')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/red|rose/i);
  });

  it('renders warm grade with orange/amber palette', () => {
    const { container } = render(<LeadGradeBadge grade="warm" score={68} />);
    expect(screen.getByText('warm')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/orange|amber/i);
  });

  it('renders cold grade with gray palette', () => {
    const { container } = render(<LeadGradeBadge grade="cold" score={45} />);
    expect(screen.getByText('cold')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/gray/i);
  });

  it('renders dormant grade with slate palette', () => {
    const { container } = render(<LeadGradeBadge grade="dormant" score={20} />);
    expect(screen.getByText('dormant')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/slate/i);
  });

  it('renders an "unscored" pill when grade or score is missing', () => {
    render(<LeadGradeBadge grade={undefined} score={undefined} />);
    expect(screen.getByText(/unscored/i)).toBeInTheDocument();
  });

  it('still renders the badge if grade is set but score is null/undefined', () => {
    render(<LeadGradeBadge grade="warm" score={undefined} />);
    expect(screen.getByText('warm')).toBeInTheDocument();
    // score area should fall back to em-dash
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
