import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Drawer from '../Drawer';
import Modal from '../Modal';

/**
 * Dialogs sharing useDialogFocus can stack: a confirmAction-style Modal
 * opened from a button inside an open Drawer. Only the topmost dialog should
 * answer Escape or trap Tab, and the scroll lock must stay held until every
 * dialog in the stack has closed.
 */
function StackHarness() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setDrawerOpen(true)}>Open drawer</button>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Drawer">
        <button type="button" onClick={() => setModalOpen(true)}>Open modal</button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirm">
          <input aria-label="Confirm field" />
        </Modal>
      </Drawer>
    </>
  );
}

function openWithFocus(name: string) {
  const el = screen.getByRole('button', { name });
  el.focus();
  fireEvent.click(el);
  return el;
}

/**
 * jsdom never lays out the page, so `offsetParent` is always null — the Tab
 * trap's "is this focusable element visible" check would filter out every
 * element but the one currently focused. Stub it per element, the usual jsdom
 * workaround, rather than touching the shared prototype.
 */
function makeVisible(el: HTMLElement) {
  Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true });
}

describe('useDialogFocus (stacked dialogs)', () => {
  it('lets only the topmost dialog answer Escape, one dialog per press', () => {
    render(<StackHarness />);
    const drawerTrigger = openWithFocus('Open drawer');
    const modalTrigger = openWithFocus('Open modal');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Confirm' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Drawer' })).toBeInTheDocument();
    expect(document.activeElement).toBe(modalTrigger);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(drawerTrigger);
  });

  it('keeps scroll locked until every dialog in the stack has closed', () => {
    document.body.style.overflow = 'scroll'; // a value the page had before any dialog opened
    render(<StackHarness />);
    openWithFocus('Open drawer');
    expect(document.body.style.overflow).toBe('hidden');
    openWithFocus('Open modal');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' }); // closes the Modal only
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' }); // closes the Drawer
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('traps Tab inside only the topmost dialog', () => {
    render(<StackHarness />);
    openWithFocus('Open drawer');
    openWithFocus('Open modal');
    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    const confirmField = screen.getByLabelText('Confirm field');
    makeVisible(closeBtn);
    makeVisible(confirmField);
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(closeBtn, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmField);

    fireEvent.keyDown(confirmField, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });
});
