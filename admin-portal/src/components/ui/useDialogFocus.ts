import { useEffect, useId, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialogs sharing this hook can stack (a `confirmAction` `ConfirmDialog`
 * opened from inside a `Drawer`, say). `openDialogs` is that stack, by id,
 * in open order — only its top should answer Escape or trap Tab, so an inner
 * dialog's Escape doesn't also fall through and close the one underneath.
 */
const openDialogs: string[] = [];

/**
 * The scroll lock is reference-counted across the same stack: the first
 * dialog to open records the page's `overflow` value at that moment, and
 * only the last dialog to close restores it — an inner dialog closing must
 * not unlock scrolling while an outer one is still open.
 */
let scrollLockDepth = 0;
let overflowBeforeLock = '';

function lockScroll(): void {
  if (scrollLockDepth === 0) overflowBeforeLock = document.body.style.overflow;
  scrollLockDepth += 1;
  document.body.style.overflow = 'hidden';
}

function unlockScroll(): void {
  scrollLockDepth = Math.max(0, scrollLockDepth - 1);
  if (scrollLockDepth === 0) document.body.style.overflow = overflowBeforeLock;
}

/**
 * Dialog behaviour shared by Modal and Drawer: Escape closes, Tab stays inside
 * the panel, the page behind does not scroll, focus moves in on open (to
 * `initialFocus` when given, else the first focusable element) and returns to
 * the trigger on close. A child that handles Escape itself (a listbox) calls
 * `e.stopPropagation()` so this document-level handler never sees it.
 *
 * Dialogs may stack: only the topmost of `openDialogs` reacts to Escape and
 * the Tab trap, and the scroll lock is reference-counted (see above), so an
 * inner dialog opened over an outer one — and later closed — never closes or
 * unlocks the one still open beneath it.
 */
export function useDialogFocus(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  initialFocus?: RefObject<HTMLElement | null>,
): void {
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const id = useId();
  // Read fresh every render (no effect dependency) so a parent that passes a
  // new `onClose` closure on every render — e.g. because opening this dialog
  // itself triggered that re-render — doesn't tear down and re-push this
  // dialog's stack entry out of its open order.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openDialogs.push(id);
    const handler = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return; // not the topmost dialog
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      const i = openDialogs.indexOf(id);
      if (i !== -1) openDialogs.splice(i, 1);
    };
  }, [open, panelRef, id]);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    return () => unlockScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus();
    return () => {
      restoreFocusRef.current?.focus?.();
    };
    // initialFocus is read once per opening, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panelRef]);
}
