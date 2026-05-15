import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import SuggestionCard from '../SuggestionCard';
import type { ConfigSuggestion } from '../../../services/platform-config';

/**
 * 002-ai-assisted-config Task 5.1 — inline suggestion card.
 *
 *   - Renders the suggested value, confidence as a percentage, rationale.
 *   - Accept/Reject fire callbacks with the field key.
 *   - Both buttons hide once the card status is "accepted" or "rejected".
 */

const baseSuggestion: ConfigSuggestion = {
  field: 'emailNotifications',
  suggestedValue: true,
  confidence: 0.82,
  rationale: 'Most colleges with 100+ students enable email notifications.',
};

describe('<SuggestionCard />', () => {
  it('renders the rationale + confidence and a formatted value', () => {
    render(<SuggestionCard suggestion={baseSuggestion} status="pending" onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/Most colleges with 100\+ students/)).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText(/true/i)).toBeInTheDocument();
  });

  it('fires onAccept with the field key', () => {
    const onAccept = vi.fn();
    render(<SuggestionCard suggestion={baseSuggestion} status="pending" onAccept={onAccept} onReject={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('emailNotifications');
  });

  it('fires onReject with the field key', () => {
    const onReject = vi.fn();
    render(<SuggestionCard suggestion={baseSuggestion} status="pending" onAccept={vi.fn()} onReject={onReject} />);
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith('emailNotifications');
  });

  it('hides accept/reject buttons once accepted', () => {
    render(<SuggestionCard suggestion={baseSuggestion} status="accepted" onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
  });

  it('hides accept/reject buttons once rejected', () => {
    render(<SuggestionCard suggestion={baseSuggestion} status="rejected" onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });

  it('renders array values as a comma-joined list', () => {
    render(
      <SuggestionCard
        suggestion={{ ...baseSuggestion, field: 'channels', suggestedValue: ['email', 'sms'] }}
        status="pending"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/email, sms/)).toBeInTheDocument();
  });

  it('renders string values inside quotes', () => {
    render(
      <SuggestionCard
        suggestion={{ ...baseSuggestion, field: 'tone', suggestedValue: 'formal' }}
        status="pending"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/"formal"/)).toBeInTheDocument();
  });
});
