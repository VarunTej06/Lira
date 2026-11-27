import { confirmDialog } from '../components/common/dialogStore';

let message: string | null = null;

/** Sets what to say when someone tries to leave the screen they are on, or null when leaving is fine. One screen at a time holds it. */
export const setLeaveGuard = (text: string | null): void => { message = text; };
export const hasLeaveGuard = (): boolean => message !== null;

/** True when it is fine to go: nothing is guarded, or the person said they want to leave. */
export async function mayLeave(): Promise<boolean> {
  if (message === null) return true;
  return confirmDialog({ title: 'Leave this page?', message, confirmLabel: 'Leave', cancelLabel: 'Stay' });
}
