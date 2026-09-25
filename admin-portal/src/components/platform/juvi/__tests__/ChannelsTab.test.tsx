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

  it('pages through channels when there are more than one page', async () => {
    (listChannels as Mock).mockImplementation(async (_status?: string, page = 1) => ({
      items: [{ _id: `c${page}`, name: `Channel page ${page}`, templateCode: 'course', scopeType: 'course_offering', status: 'active', memberCount: 1, replyRule: 'allowed', defaultPriority: 'routine' }],
      total: 150, page, pages: 2,
    }));
    renderWithProviders(<ChannelsTab />);
    expect(await screen.findByText('Channel page 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText('Channel page 2')).toBeInTheDocument();
    expect(listChannels).toHaveBeenLastCalledWith('active', 2, 100);
    fireEvent.click(screen.getByRole('button', { name: /^archived$/i }));
    await screen.findByText('Page 1 of 2');
    expect(listChannels).toHaveBeenLastCalledWith('archived', 1, 100);
  });

  it('shows the templates read-only with a note about editing', async () => {
    renderWithProviders(<ChannelsTab />);
    expect(await screen.findByText('{{college.name}}')).toBeInTheDocument();
    expect(screen.getByText(/templates are read-only in this release/i)).toBeInTheDocument();
  });
});
