/**
 * Whether the person is typing here: a text box, a dropdown, or one of the rich text editors (description, comments).
 * Keyboard shortcuts and Lira's own right-click menu stay out of the way of these.
 */
export const isEditable = (target: EventTarget | null | undefined): boolean =>
  !!(target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
