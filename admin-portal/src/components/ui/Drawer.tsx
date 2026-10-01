import { useId, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useDialogFocus } from './useDialogFocus';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional supporting copy announced with the title. */
  description?: string;
  /** Pinned under the scrolling body (actions). */
  footer?: React.ReactNode;
  widthClass?: string;
  /** Receives focus on open instead of the first focusable element (the close button). */
  initialFocus?: RefObject<HTMLElement | null>;
}

/** A right-hand panel with the same dialog behaviour as Modal (useDialogFocus). */
export default function Drawer({ open, onClose, title, children, description, footer, widthClass = 'max-w-2xl', initialFocus }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogFocus(open, onClose, panelRef, initialFocus);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx('relative flex h-full w-full flex-col bg-white shadow-xl focus:outline-none', widthClass)}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold">{title}</h3>
            {description && <p id={descId} className="mt-0.5 text-xs text-gray-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1 hover:bg-gray-100">
            <X size={18} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
