/**
 * Tests for <PersonPhotoBlock /> — the editable photo card on Person
 * detail pages.
 *
 * The component combines several concerns; tests cover them in groups:
 *   - Permission gating          → upload/replace/delete buttons are
 *                                   visible iff `people:update` is granted
 *   - Photo / no-photo branching → initials fallback vs. <img>
 *   - File picker validation     → oversize / wrong-mime files surface
 *                                   inline errors WITHOUT opening the
 *                                   confirm modal
 *   - Confirm-upload modal       → opens with selected filename + size,
 *                                   triggers `uploadEntityPhoto` on confirm
 *
 * Mocks:
 *   - `services/people` is mocked with controllable `getEntityPhotoUrl`,
 *     `uploadEntityPhoto`, `deleteEntityPhoto` jest fns.
 *   - `stores/authStore` is mocked with a configurable `hasPermission`
 *     return value (default: true). Tests opt-in to the read-only path
 *     by toggling the helper between renders.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PersonPhotoBlock from '../PersonPhotoBlock';
import { renderWithProviders } from '../../../__tests__/test-utils';

// ── Mock the service module ────────────────────────────────────────────
vi.mock('../../../services/people', () => ({
  getEntityPhotoUrl: vi.fn(),
  uploadEntityPhoto: vi.fn(),
  deleteEntityPhoto: vi.fn(),
}));

// ── Mock the auth store ────────────────────────────────────────────────
// PersonPhotoBlock calls `useAuthStore(s => s.hasPermission(...))`. Provide
// a Zustand-shaped function: it must accept a selector and return whatever
// the selector pulls off the configured mock state.
let mockHasPermission = vi.fn().mockReturnValue(true);

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: <T,>(selector: (state: { hasPermission: typeof mockHasPermission }) => T): T =>
    selector({ hasPermission: mockHasPermission }),
}));

import {
  getEntityPhotoUrl,
  uploadEntityPhoto,
  deleteEntityPhoto,
} from '../../../services/people';

const mockedGetUrl = getEntityPhotoUrl as Mock;
const mockedUpload = uploadEntityPhoto as Mock;
const mockedDelete = deleteEntityPhoto as Mock;

beforeEach(() => {
  mockedGetUrl.mockReset();
  mockedUpload.mockReset();
  mockedDelete.mockReset();
  mockHasPermission = vi.fn().mockReturnValue(true);
});

// Helper: make a File with a given size in bytes.
function makeImageFile(opts: { name?: string; type?: string; sizeBytes?: number } = {}): File {
  const { name = 'photo.jpg', type = 'image/jpeg', sizeBytes = 1024 } = opts;
  // Constructing a Buffer-like array is fine; jsdom's File supports `size`.
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('<PersonPhotoBlock /> — no photo + permission gating', () => {
  it('renders the initials avatar and the [Upload photo] button when user has people:update', async () => {
    mockedGetUrl.mockResolvedValue({}); // no photo
    mockHasPermission = vi.fn().mockReturnValue(true);

    renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s1" personName="Alice Wong" />,
    );

    // Initials avatar
    const initials = await screen.findByLabelText('Alice Wong initials');
    expect(initials).toHaveTextContent('AW');

    // Upload button
    expect(screen.getByRole('button', { name: /Upload photo/i })).toBeInTheDocument();
    // No replace/delete buttons because there's no photo.
    expect(screen.queryByRole('button', { name: /Replace/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull();
  });

  it('hides the upload button when user lacks people:update', async () => {
    mockedGetUrl.mockResolvedValue({});
    mockHasPermission = vi.fn().mockReturnValue(false);

    renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s2" personName="Bob Singh" />,
    );

    // Initials still render
    expect(await screen.findByLabelText('Bob Singh initials')).toBeInTheDocument();
    // No upload/replace/delete buttons.
    expect(screen.queryByRole('button', { name: /Upload photo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Replace/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull();
  });
});

describe('<PersonPhotoBlock /> — has photo + permission gating', () => {
  it('renders the thumbnail <img> + [Replace] + [Delete] buttons when user has permission', async () => {
    mockedGetUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/photo.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });
    mockHasPermission = vi.fn().mockReturnValue(true);

    renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s3" personName="Carol Brown" />,
    );

    const img = await screen.findByRole('img', { name: 'Carol Brown photo' });
    expect(img).toHaveAttribute('src', 'https://cdn.test/photo.jpg');

    expect(screen.getByRole('button', { name: /Replace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload photo/i })).toBeNull();
  });

  it('renders the thumbnail but no Replace/Delete buttons when user lacks permission', async () => {
    mockedGetUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/photo.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });
    mockHasPermission = vi.fn().mockReturnValue(false);

    renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s4" personName="Dev Patel" />,
    );

    expect(await screen.findByRole('img', { name: 'Dev Patel photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Replace/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull();
  });
});

describe('<PersonPhotoBlock /> — file picker validation', () => {
  it('rejects an oversize file (>5 MB) inline without opening the confirm modal', async () => {
    mockedGetUrl.mockResolvedValue({});
    const user = userEvent.setup();

    const { container } = renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s5" personName="Eve Davis" />,
    );

    await screen.findByRole('button', { name: /Upload photo/i });

    // Trigger the hidden file input via userEvent.upload.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const big = makeImageFile({ name: 'big.jpg', sizeBytes: 6 * 1024 * 1024 });
    await user.upload(input, big);

    // Inline error message
    expect(await screen.findByText(/File too large/i)).toBeInTheDocument();
    // No modal opens.
    expect(screen.queryByRole('dialog', { name: /Confirm photo/i })).toBeNull();
    // Upload mutation never fires.
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('rejects a non-image (text/plain) file inline without opening the modal', async () => {
    mockedGetUrl.mockResolvedValue({});

    const { container } = renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s6" personName="Fay Green" />,
    );

    await screen.findByRole('button', { name: /Upload photo/i });

    // Note: `userEvent.upload` honours the input's `accept` attribute and
    // silently filters non-matching files, which would prevent the
    // component's own mime-type guard from running. Using fireEvent.change
    // directly bypasses that filter — exactly what we want to verify the
    // client-side validation path.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const txt = makeImageFile({ name: 'note.txt', type: 'text/plain', sizeBytes: 100 });
    fireEvent.change(input, { target: { files: [txt] } });

    expect(await screen.findByText(/Unsupported format/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Confirm photo/i })).toBeNull();
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

describe('<PersonPhotoBlock /> — confirm-upload modal flow', () => {
  it('opens the confirm modal showing filename and a [Confirm upload] button after a valid file is selected', async () => {
    mockedGetUrl.mockResolvedValue({});
    const user = userEvent.setup();

    const { container } = renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s7" personName="Grace Liu" />,
    );

    await screen.findByRole('button', { name: /Upload photo/i });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile({ name: 'me.jpg', sizeBytes: 200_000 });
    await user.upload(input, file);

    // Modal appears with filename + Confirm upload button.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('me.jpg')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Confirm upload/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('calls uploadEntityPhoto with (entityType, entityId, file, onProgress) when [Confirm upload] is clicked', async () => {
    mockedGetUrl.mockResolvedValue({});
    mockedUpload.mockResolvedValue({
      original: 'orig-key',
      thumb: 'thumb-key',
      contentType: 'image/jpeg',
      sizeBytes: 200_000,
      uploadedAt: '2026-04-27T10:00:00.000Z',
    });
    const user = userEvent.setup();

    const { container } = renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s8" personName="Hank Vega" />,
    );

    await screen.findByRole('button', { name: /Upload photo/i });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeImageFile({ name: 'h.jpg', sizeBytes: 100_000 });
    await user.upload(input, file);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Confirm upload/i }));

    await waitFor(() => {
      expect(mockedUpload).toHaveBeenCalledTimes(1);
    });
    const [calledType, calledId, calledFile, onProgress] = mockedUpload.mock.calls[0] ?? [];
    expect(calledType).toBe('students');
    expect(calledId).toBe('s8');
    expect(calledFile).toBe(file);
    expect(typeof onProgress).toBe('function');
  });

  it('cancels and dismisses the confirm modal without invoking the upload mutation', async () => {
    mockedGetUrl.mockResolvedValue({});
    const user = userEvent.setup();

    const { container } = renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s9" personName="Iris Khan" />,
    );

    await screen.findByRole('button', { name: /Upload photo/i });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeImageFile({ name: 'i.jpg', sizeBytes: 100 }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

describe('<PersonPhotoBlock /> — delete flow', () => {
  it('opens a confirm dialog when [Delete] is clicked and dispatches deleteEntityPhoto on confirm', async () => {
    mockedGetUrl.mockResolvedValue({
      thumb: { url: 'https://cdn.test/photo.jpg', expiresAt: '2099-01-01T00:00:00Z' },
    });
    mockedDelete.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <PersonPhotoBlock entityType="students" entityId="s10" personName="Jay Kim" />,
    );

    const deleteBtn = await screen.findByRole('button', { name: /Delete/i });
    await user.click(deleteBtn);

    const dialog = await screen.findByRole('dialog', { name: /Delete photo/i });
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith('students', 's10');
    });
  });
});
