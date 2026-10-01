import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import LegacyNoticesBanner from '../LegacyNoticesBanner';
import { renderWithProviders } from '../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ hasPermission: () => perm.can }) }));

describe('LegacyNoticesBanner', () => {
  it('says official notices go to Juvi and links to the Notices page', () => {
    perm.can = true;
    renderWithProviders(<LegacyNoticesBanner kind="circulars" />);
    expect(screen.getByRole('note')).toHaveTextContent('Official notices now go to Juvi. These circulars are kept as records');
    expect(screen.getByRole('link', { name: 'Go to Notices' })).toHaveAttribute('href', '/communication/notices');
  });

  it('gives no link to someone who cannot open Notices', () => {
    perm.can = false;
    renderWithProviders(<LegacyNoticesBanner kind="announcements" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Ask your college office to publish it as a Juvi notice.');
  });
});
