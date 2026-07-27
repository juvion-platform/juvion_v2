import { describe, it, expect, beforeEach } from 'vitest';
import { useConfirmStore, confirmAction, confirmDelete } from '../confirmStore';

describe('confirmStore', () => {
  beforeEach(() => {
    useConfirmStore.setState({ open: false, options: null, resolve: null });
  });

  it('opens with the supplied options and resolves on confirm', async () => {
    const pending = confirmAction({ title: 'Delete this batch?', tone: 'danger' });

    expect(useConfirmStore.getState().open).toBe(true);
    expect(useConfirmStore.getState().options?.title).toBe('Delete this batch?');

    useConfirmStore.getState().respond({ confirmed: true });

    await expect(pending).resolves.toEqual({ confirmed: true });
    expect(useConfirmStore.getState().open).toBe(false);
  });

  it('resolves false on cancel', async () => {
    const pending = confirmAction({ title: 'Sure?' });
    useConfirmStore.getState().respond({ confirmed: false });
    await expect(pending).resolves.toEqual({ confirmed: false });
  });

  it('passes a captured reason back to the caller', async () => {
    const pending = confirmAction({ title: 'Reject?', requireReason: true });
    useConfirmStore.getState().respond({ confirmed: true, reason: 'Incomplete evidence' });
    await expect(pending).resolves.toEqual({ confirmed: true, reason: 'Incomplete evidence' });
  });

  it('cancels a superseded request rather than leaving it pending forever', async () => {
    const first = confirmAction({ title: 'First' });
    const second = confirmAction({ title: 'Second' });

    await expect(first).resolves.toEqual({ confirmed: false });
    expect(useConfirmStore.getState().options?.title).toBe('Second');

    useConfirmStore.getState().respond({ confirmed: true });
    await expect(second).resolves.toEqual({ confirmed: true });
  });

  it('confirmDelete defaults to a danger-toned delete prompt', async () => {
    const pending = confirmDelete('batch');
    const opts = useConfirmStore.getState().options;
    expect(opts?.title).toBe('Delete this batch?');
    expect(opts?.tone).toBe('danger');
    expect(opts?.confirmLabel).toBe('Delete');

    useConfirmStore.getState().respond({ confirmed: true });
    await expect(pending).resolves.toBe(true);
  });
});
