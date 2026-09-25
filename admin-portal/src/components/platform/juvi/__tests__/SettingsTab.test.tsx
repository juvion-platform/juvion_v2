import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsTab from '../SettingsTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { hasPermission: () => boolean }) => unknown) => selector({ hasPermission: () => perm.can }),
}));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../services/juvi-app', () => ({ getJuviSettings: vi.fn(), updateJuviSettings: vi.fn(), reconcileNow: vi.fn() }));
import { getJuviSettings, updateJuviSettings, reconcileNow } from '../../../../services/juvi-app';
import { toast } from '../../../../stores/toastStore';

const VIEW = {
  juvi: { enabled: false, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false } },
  college: { name: 'JIT', code: 'JIT' },
  lastReconcile: null,
};

beforeEach(() => {
  vi.clearAllMocks(); perm.can = true;
  (getJuviSettings as Mock).mockResolvedValue(VIEW);
  (updateJuviSettings as Mock).mockImplementation(async (patch: any) => ({ ...VIEW, juvi: { ...VIEW.juvi, ...patch } }));
  (reconcileNow as Mock).mockResolvedValue({ queued: true });
});

describe('SettingsTab', () => {
  it('loads settings into the form and saves only changed fields', async () => {
    renderWithProviders(<SettingsTab />);
    const enable = await screen.findByLabelText(/enable juvi for this college/i);
    expect(enable).not.toBeChecked();
    fireEvent.click(enable);
    fireEvent.change(screen.getByLabelText(/accent colour/i), { target: { value: '#0B5FA5' } });
    fireEvent.change(screen.getByLabelText(/support contact name/i), { target: { value: 'Student Office' } });
    fireEvent.click(screen.getByRole('button', { name: /^save settings$/i }));
    await waitFor(() => expect(updateJuviSettings).toHaveBeenCalledWith({ enabled: true, accentColor: '#0B5FA5', supportContact: { name: 'Student Office' } }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the pause message field only when paused, and validates the colour', async () => {
    renderWithProviders(<SettingsTab />);
    await screen.findByLabelText(/enable juvi for this college/i);
    expect(screen.queryByLabelText(/message shown to users/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/pause juvi/i));
    expect(screen.getByLabelText(/message shown to users/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/accent colour/i), { target: { value: 'blue' } });
    fireEvent.click(screen.getByRole('button', { name: /^save settings$/i }));
    expect(await screen.findByText(/hex colour like #0B5FA5/i)).toBeInTheDocument();
    expect(updateJuviSettings).not.toHaveBeenCalled();
  });

  it('shows the last reconcile summary and triggers a manual run', async () => {
    (getJuviSettings as Mock).mockResolvedValue({ ...VIEW, juvi: { ...VIEW.juvi, enabled: true }, lastReconcile: { at: '2026-09-23T03:00:00Z', durationMs: 1234, skipped: false, channels: { total: 42, created: 1, archived: 0, unarchived: 0 }, memberships: { added: 10, removed: 2, roleChanged: 0 }, errors: 0 } });
    renderWithProviders(<SettingsTab />);
    expect(await screen.findByText(/42 channels/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reconcile now/i }));
    await waitFor(() => expect(reconcileNow).toHaveBeenCalled());
  });

  it('disables saving without platform:update', async () => {
    perm.can = false;
    renderWithProviders(<SettingsTab />);
    await screen.findByLabelText(/enable juvi for this college/i);
    expect(screen.getByRole('button', { name: /^save settings$/i })).toBeDisabled();
  });
});
