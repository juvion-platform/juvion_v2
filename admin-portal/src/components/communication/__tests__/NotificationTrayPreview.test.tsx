import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import NotificationTrayPreview from '../NotificationTrayPreview';

const tray = () => screen.getByRole('region', { name: 'Phone notification preview' });

describe('NotificationTrayPreview (notifications spec §6.6, §9)', () => {
  it('shows the office and the title, and the reminder wording', () => {
    render(<NotificationTrayPreview office="Exam Section" title="Hall tickets are out" priority="important" confidential={false} welcome={false} />);
    expect(within(tray()).getAllByText('Exam Section')).toHaveLength(2);
    expect(within(tray()).getByText('Hall tickets are out')).toBeInTheDocument();
    expect(within(tray()).getByText('Reminder: Hall tickets are out')).toBeInTheDocument();
    expect(within(tray()).getByText(/Plays a sound\. During someone's quiet hours/)).toBeInTheDocument();
  });

  it('never shows the title of a confidential notice', () => {
    render(<NotificationTrayPreview office="Exam Section" title="Revaluation results" priority="important" confidential welcome={false} />);
    expect(within(tray()).getByText('New notice from Exam Section')).toBeInTheDocument();
    expect(within(tray()).getByText('Reminder from Exam Section')).toBeInTheDocument();
    expect(tray()).not.toHaveTextContent('Revaluation results');
  });

  it('says a Routine notice is silent and batched, and an Urgent one rings', () => {
    const { rerender } = render(<NotificationTrayPreview office="Registrar" title="Library hours" priority="routine" confidential={false} welcome={false} />);
    const first = within(tray()).getByText('When published').nextElementSibling as HTMLElement;
    expect(first).toHaveTextContent('Silent');
    expect(tray()).toHaveTextContent('Silent. Routine notices from one office within 15 minutes arrive as one notification.');
    rerender(<NotificationTrayPreview office="Registrar" title="Campus closed today" priority="urgent" confidential={false} welcome={false} />);
    expect(within(tray()).getByText('When published').nextElementSibling).toHaveTextContent('Rings');
    expect(tray()).toHaveTextContent('Rings at once, even during quiet hours and when the channel is muted.');
    // A reminder always notifies as Important.
    expect(within(tray()).getByText('If you send a reminder').nextElementSibling).toHaveTextContent('Sound');
  });

  it('says a welcome notice is not pushed', () => {
    render(<NotificationTrayPreview office="College Office" title="Welcome to Juvi" priority="routine" confidential={false} welcome />);
    expect(tray()).toHaveTextContent('A welcome notice sends no phone notification. New accounts see it at onboarding.');
    expect(tray()).not.toHaveTextContent('Welcome to Juvi');
  });
});
