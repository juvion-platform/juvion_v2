/**
 * Tests for the per-row <PersonThumbnail /> avatar.
 *
 * Covers the four render branches in PersonThumbnail.tsx:
 *   1. Loading        — useQuery in flight → animate-pulse placeholder
 *   2. Photo found    — service resolves with `{ thumb: { url, expiresAt }}`
 *                       → <img loading="lazy"> with the resolved URL
 *   3. No photo (empty) — service resolves with `{}` → initials fallback
 *   4. Service error  — service rejects → initials fallback
 *   5. Image broken   — img onError handler flips back to initials
 *
 * The `getEntityPhotoUrl` service is mocked at module level via `vi.mock`
 * with a controllable resolver per test. Renders are wrapped in our shared
 * QueryClientProvider helper (retry disabled) so error paths are tested
 * deterministically without retry storms.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import PersonThumbnail from '../PersonThumbnail';
import { renderWithProviders } from '../../../__tests__/test-utils';
import type { StudentPhotoUrlsResponse } from '../../../services/people';

// ── Mock the service module ────────────────────────────────────────────
vi.mock('../../../services/people', () => ({
  getEntityPhotoUrl: vi.fn(),
}));

// Re-import the mocked function so we can configure it per test.
import { getEntityPhotoUrl } from '../../../services/people';
const mockedGetEntityPhotoUrl = getEntityPhotoUrl as Mock;

beforeEach(() => {
  mockedGetEntityPhotoUrl.mockReset();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe('<PersonThumbnail /> — loading state', () => {
  it('renders an animate-pulse placeholder while the photo URL query is in flight', () => {
    // Promise that never resolves → query stays in `isLoading` indefinitely.
    mockedGetEntityPhotoUrl.mockReturnValue(new Promise<StudentPhotoUrlsResponse>(() => {}));

    const { container } = renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s1" personName="Alice Wong" />,
    );

    const placeholder = container.querySelector('.animate-pulse');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveClass('rounded-full', 'bg-slate-200');
    // No initials are rendered while loading.
    expect(screen.queryByLabelText('Alice Wong initials')).toBeNull();
    // No image either.
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('<PersonThumbnail /> — photo found', () => {
  it('renders an <img loading="lazy"> with the resolved URL once the query succeeds', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/thumb-abc.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });

    renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s2" personName="Bob Singh" />,
    );

    const img = await screen.findByRole('img', { name: 'Bob Singh photo' });
    expect(img).toHaveAttribute('src', 'https://cdn.test/thumb-abc.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('passes through the service call with the right entityType + entityId + variant', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/x.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });

    renderWithProviders(
      <PersonThumbnail entityType="faculty" entityId="f9" personName="Dr. Mehta" />,
    );

    await screen.findByRole('img', { name: 'Dr. Mehta photo' });
    expect(mockedGetEntityPhotoUrl).toHaveBeenCalledWith('faculty', 'f9', 'thumb');
  });
});

describe('<PersonThumbnail /> — no photo (empty response)', () => {
  it('renders the initials avatar when the service returns `{}`', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({});

    renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s3" personName="Carol Brown" />,
    );

    // Initials = first letter of first + last names → "CB".
    const avatar = await screen.findByLabelText('Carol Brown initials');
    expect(avatar).toHaveTextContent('CB');
    expect(avatar.tagName).toBe('DIV');
  });

  it('renders a single-letter initial when only one name part is provided', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({});

    renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s4" personName="Dev" />,
    );

    const avatar = await screen.findByLabelText('Dev initials');
    expect(avatar).toHaveTextContent('D');
  });

  it('renders "?" when no personName is supplied', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({});

    renderWithProviders(<PersonThumbnail entityType="students" entityId="s5" />);

    const avatar = await screen.findByLabelText('Initials');
    expect(avatar).toHaveTextContent('?');
  });
});

describe('<PersonThumbnail /> — error fallback', () => {
  it('renders initials when the service rejects', async () => {
    mockedGetEntityPhotoUrl.mockRejectedValue(new Error('boom'));

    renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s6" personName="Eve Davis" />,
    );

    const avatar = await screen.findByLabelText('Eve Davis initials');
    expect(avatar).toHaveTextContent('ED');
  });
});

describe('<PersonThumbnail /> — broken image fallback', () => {
  it('flips to initials when the rendered <img> fires onError', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/expired.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });

    renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s7" personName="Fay Green" />,
    );

    const img = await screen.findByRole('img', { name: 'Fay Green photo' });
    expect(img).toBeInTheDocument();

    // Simulate the browser failing to load the resource (e.g. expired presign).
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Fay Green photo' })).toBeNull();
    });
    expect(screen.getByLabelText('Fay Green initials')).toHaveTextContent('FG');
  });
});

describe('<PersonThumbnail /> — sizing', () => {
  it('respects the `size` prop on both the placeholder and the rendered image', async () => {
    mockedGetEntityPhotoUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/x.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });

    renderWithProviders(
      <PersonThumbnail entityType="students" entityId="s8" personName="X Y" size={48} />,
    );

    const img = await screen.findByRole('img', { name: 'X Y photo' });
    expect(img).toHaveStyle({ width: '48px', height: '48px' });
  });
});
