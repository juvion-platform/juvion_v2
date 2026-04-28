import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useViewEditMode } from '../useViewEditMode';

interface Row {
  _id: string;
  name: string;
}

const ROW: Row = { _id: '64a000000000000000000001', name: 'Source row' };

describe('useViewEditMode — base modes', () => {
  it('opens in view mode and surfaces the entity', () => {
    const onOpenEntity = vi.fn();
    const { result } = renderHook(() => useViewEditMode<Row>({ onOpenEntity }));

    act(() => result.current.openForView(ROW));

    expect(result.current.isView).toBe(true);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.entity).toBe(ROW);
    expect(onOpenEntity).toHaveBeenCalledWith(ROW);
  });

  it('opens in create mode and clears the entity', () => {
    const onOpenCreate = vi.fn();
    const { result } = renderHook(() => useViewEditMode<Row>({ onOpenCreate }));

    act(() => result.current.openForCreate());

    expect(result.current.isCreate).toBe(true);
    expect(result.current.entity).toBeNull();
    expect(onOpenCreate).toHaveBeenCalled();
  });
});

describe('useViewEditMode — openForCopy', () => {
  it('populates form (via onOpenEntity) but lands in CREATE mode with no entity', () => {
    const onOpenEntity = vi.fn();
    const onOpenCreate = vi.fn();
    const { result } = renderHook(() =>
      useViewEditMode<Row>({ onOpenEntity, onOpenCreate }),
    );

    act(() => result.current.openForCopy(ROW));

    // Source row must be passed through onOpenEntity so the page can prefill
    expect(onOpenEntity).toHaveBeenCalledWith(ROW);
    // …but the modal opens in CREATE mode (so submit goes through the create path)
    expect(result.current.isCreate).toBe(true);
    expect(result.current.isEdit).toBe(false);
    expect(result.current.isView).toBe(false);
    // …and the entity is null so the page doesn't accidentally route through update
    expect(result.current.entity).toBeNull();
    // onOpenCreate should NOT fire — that would clobber the prefill we just did
    expect(onOpenCreate).not.toHaveBeenCalled();
  });

  it('titleFor reports "New <entity>" in copy mode (not "Edit")', () => {
    const { result } = renderHook(() => useViewEditMode<Row>());

    act(() => result.current.openForCopy(ROW));

    expect(result.current.titleFor('Fee Structure')).toBe('New Fee Structure');
  });

  it('close() after openForCopy returns to fully-closed state', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useViewEditMode<Row>({ onClose }));

    act(() => result.current.openForCopy(ROW));
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.entity).toBeNull();
    expect(result.current.mode).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });
});
