import { useCallback, useState } from 'react';

/**
 * Shared state machine for the "clickable-row → view modal with Edit button"
 * pattern used across list pages in the admin portal.
 *
 * Lifecycle:
 *   closed  ─openForView(row)→  view
 *           ─openForEdit(row)→  edit
 *           ─openForCreate() →  create
 *
 *   view    ─switchToEdit()  →  edit    (keeps same entity)
 *   any     ─close()         →  closed
 *
 * Usage in a list page:
 * ```tsx
 * const vem = useViewEditMode<Department>({
 *   onOpenEntity: (row) => populateForm(row),
 *   onOpenCreate: () => setForm(emptyForm),
 *   onClose:      () => setForm(emptyForm),
 * });
 *
 * <DataTable onRowClick={vem.openForView} ... />
 * <button onClick={vem.openForCreate}>+ New</button>
 *
 * <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Department')}>
 *   <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
 *     ...inputs bound to form state as usual...
 *   </fieldset>
 *   <Footer>
 *     {vem.isView
 *       ? <button onClick={vem.switchToEdit}>Edit</button>
 *       : <button type="submit">Save</button>}
 *   </Footer>
 * </Modal>
 * ```
 */

export type ModalMode = 'view' | 'edit' | 'create';

export interface UseViewEditModeOpts<T> {
  /**
   * Fires when the modal opens with an entity (view or edit mode).
   * Use this to populate form state from the row. Runs BEFORE the mode
   * transition is observable so the UI sees fresh data from the first render.
   */
  onOpenEntity?: (entity: T) => void;
  /**
   * Fires when the modal opens in create mode. Use this to reset form
   * state to empty defaults.
   */
  onOpenCreate?: () => void;
  /**
   * Fires when the modal closes from any mode. Use this if you need to
   * clean up transient state beyond what onOpenCreate will do on next open.
   */
  onClose?: () => void;
  /**
   * Fires when the modal transitions from view → edit via `switchToEdit()`.
   * Rarely needed; form state should already be populated by the preceding
   * `onOpenEntity`. Use for analytics / focus management.
   */
  onSwitchToEdit?: (entity: T) => void;
}

export interface ViewEditModeApi<T> {
  /** Current mode, or null when the modal is closed. */
  mode: ModalMode | null;
  /** True if any of view / edit / create is active. */
  isOpen: boolean;
  isView: boolean;
  isEdit: boolean;
  isCreate: boolean;
  /** The entity being viewed or edited. Null in create mode or when closed. */
  entity: T | null;
  /** Open the modal in view mode for a row (from DataTable row click). */
  openForView: (entity: T) => void;
  /** Open the modal in edit mode for a row (from the per-row pencil button). */
  openForEdit: (entity: T) => void;
  /** Open the modal in create mode (from the page's "+ New" button). */
  openForCreate: () => void;
  /**
   * Transition view → edit, keeping the current entity. No-op outside view.
   *
   * Accepts the React synthetic event from the button's `onClick` so it can
   * call `preventDefault()`. This is REQUIRED to avoid an insidious bug:
   * React 18 flushes state updates synchronously inside click handlers, so
   * when we change `mode` from 'view' to 'edit', React immediately re-renders
   * the footer's conditional `{isView ? <Edit/> : <Save/>}`. Because both
   * branches render a `<button>` at the same position, React reuses the
   * DOM node and only mutates `type="button"` → `type="submit"`. THEN the
   * browser processes the click's default action using the NEW type,
   * submitting the form and triggering the mutation → modal closes.
   *
   * Calling preventDefault() on the click event stops the browser's default
   * form-submission, so the Edit button cleanly transitions to edit mode
   * without silently creating a record.
   */
  switchToEdit: (e?: React.SyntheticEvent) => void;
  /** Close the modal. */
  close: () => void;
  /**
   * Formats a title like "View Department" / "Edit Department" / "New Department".
   * Returns "" when the modal is closed (shouldn't render but safe).
   */
  titleFor: (entityName: string) => string;
}

export function useViewEditMode<T>(opts: UseViewEditModeOpts<T> = {}): ViewEditModeApi<T> {
  const [mode, setMode] = useState<ModalMode | null>(null);
  const [entity, setEntity] = useState<T | null>(null);

  const { onOpenEntity, onOpenCreate, onClose, onSwitchToEdit } = opts;

  const openForView = useCallback((e: T) => {
    // Populate form state BEFORE we flip the mode so the first render of
    // the modal sees correct values — avoids a flash of empty inputs.
    onOpenEntity?.(e);
    setEntity(e);
    setMode('view');
  }, [onOpenEntity]);

  const openForEdit = useCallback((e: T) => {
    onOpenEntity?.(e);
    setEntity(e);
    setMode('edit');
  }, [onOpenEntity]);

  const openForCreate = useCallback(() => {
    onOpenCreate?.();
    setEntity(null);
    setMode('create');
  }, [onOpenCreate]);

  const switchToEdit = useCallback((e?: React.SyntheticEvent) => {
    // See the `switchToEdit` doc in the type definition above for the full
    // explanation. TL;DR: preventDefault blocks the browser from treating
    // the (now type="submit") button's click as a form submission after
    // React re-renders mid-event.
    e?.preventDefault?.();
    setMode((prev) => {
      if (prev !== 'view') return prev;
      if (entity && onSwitchToEdit) onSwitchToEdit(entity);
      return 'edit';
    });
  }, [entity, onSwitchToEdit]);

  const close = useCallback(() => {
    setMode(null);
    setEntity(null);
    onClose?.();
  }, [onClose]);

  const titleFor = useCallback((entityName: string) => {
    switch (mode) {
      case 'view':   return `${entityName} Details`;
      case 'edit':   return `Edit ${entityName}`;
      case 'create': return `New ${entityName}`;
      default:       return '';
    }
  }, [mode]);

  return {
    mode,
    isOpen: mode !== null,
    isView: mode === 'view',
    isEdit: mode === 'edit',
    isCreate: mode === 'create',
    entity,
    openForView,
    openForEdit,
    openForCreate,
    switchToEdit,
    close,
    titleFor,
  };
}
