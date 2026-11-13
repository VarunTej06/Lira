import { useCallback, useEffect } from 'react';
import { confirmDialog } from '../../common/dialogStore';
import { useLatest } from '../../../hooks/useLatest';

/**
 * Closing the ticket (X, outside click, Escape) asks first when there are unsaved changes.
 * While the ticket is open the page behind it does not scroll. `dirtyRef` always holds the newest answer, for the Save button.
 */
export function useCloseGuard(dirty: boolean, onClose: () => void) {
  const dirtyRef = useLatest(dirty);
  const requestClose = useCallback(async () => {
    if (!dirtyRef.current) { onClose(); return; }
    const discard = await confirmDialog({
      title: 'Discard changes?',
      message: 'You have unsaved changes to this ticket. If you close it now they are lost.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    });
    if (discard) onClose();
  }, [onClose, dirtyRef]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') void requestClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [requestClose]);

  return { requestClose, dirtyRef };
}
