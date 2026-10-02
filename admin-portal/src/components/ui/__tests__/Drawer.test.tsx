import { describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Drawer from '../Drawer';
import Modal from '../Modal';

function Harness({ withInitial = false }: { withInitial?: boolean }) {
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open composer</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New notice" description="Sent to the Juvi app" initialFocus={withInitial ? first : undefined}
        footer={<button type="button">Publish</button>}>
        <label htmlFor="t">Title</label>
        <input id="t" ref={first} />
        <input aria-label="Picker search" onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation(); }} />
      </Drawer>
    </>
  );
}

function openWithKeyboardFocus() {
  const trigger = screen.getByRole('button', { name: 'Open composer' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('Drawer', () => {
  it('is a labelled modal dialog with its footer', () => {
    render(<Harness />);
    openWithKeyboardFocus();
    const dialog = screen.getByRole('dialog', { name: 'New notice' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Sent to the Juvi app');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('focuses initialFocus on open, closes on Escape and returns focus to the trigger', () => {
    render(<Harness withInitial />);
    const trigger = openWithKeyboardFocus();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to the first focusable element and ignores an Escape a child already handled', () => {
    render(<Harness />);
    openWithKeyboardFocus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panel' }));
    fireEvent.keyDown(screen.getByLabelText('Picker search'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks body scroll while open', () => {
    render(<Harness />);
    openWithKeyboardFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Modal (on the shared hook)', () => {
  it('still closes on Escape and returns focus', () => {
    function M() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open composer</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Edit"><input aria-label="Name" /></Modal>
        </>
      );
    }
    render(<M />);
    const trigger = openWithKeyboardFocus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
