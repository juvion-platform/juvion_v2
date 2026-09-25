import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ChannelsTab from '../ChannelsTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

vi.mock('../../../../services/juvi-app', () => ({ listChannels: vi.fn(), listTemplates: vi.fn() }));
import { listChannels, listTemplates } from '../../../../services/juvi-app';

beforeEach(() => {
  vi.clearAllMocks();
  (listChannels as Mock).mockImplementation(async (status?: string) => ({
    items: status === 'archived'
      ? [{ _id: 'c9', name: 'CS101 Old · A', templateCode: 'course', scopeType: 'course_offering', status: 'archived', memberCount: 60, replyRule: 'allowed', defaultPriority: 'routine' }]
      : [{ _id: 'c1', name: 'JIT', templateCode: 'college', scopeType: 'college', status: 'active', memberCount: 1500, replyRule: 'announcement_only', defaultPriority: 'important' }],
    total: 1, page: 1, pages: 1,
  }));
  (listTemplates as Mock).mockResolvedValue({ items: [{ code: 'college', name: 'College', namePattern: '{{college.name}}', scopeType: 'college', replyRule: 'announcement_only', defaultPriority: 'important', archiveRule: 'never', isEnabled: true }] });
});

describe('ChannelsTab', () => {
  it('lists active channels by default and switches to archived', async () => {
    renderWithProviders(<ChannelsTab />);
    expect(await screen.findByText('JIT')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^archived$/i }));
    expect(await screen.findByText('CS101 Old · A')).toBeInTheDocument();
  });

  it('shows the templates read-only with a note about editing', async () => {
    renderWithProviders(<ChannelsTab />);
    expect(await screen.findByText('{{college.name}}')).toBeInTheDocument();
    expect(screen.getByText(/templates are read-only in this release/i)).toBeInTheDocument();
  });
});
