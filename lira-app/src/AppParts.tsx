import { AppSkeleton } from './components/common/Skeleton';
import { APP_VERSION } from './utils/appVersion';

/** The loading screen while the app starts: the shape of the app in grey blocks, so nothing jumps when it arrives. */
export function StartupScreen() {
  return <AppSkeleton label={`Initializing Liraspaces v${APP_VERSION}`} />;
}

/** Shown instead of the ticket popup when it crashes while drawing. Clicking anywhere or Close dismisses it. */
export function IssueCrashFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl p-8 max-w-md text-center">
        <p className="text-lg font-semibold text-lira-text mb-2">Failed to render this issue</p>
        <p className="text-sm text-lira-muted mb-4">There was an error displaying the issue details.</p>
        <button onClick={onClose} className="px-4 py-2 bg-lira-blue text-lira-on-blue rounded-lg text-sm font-medium hover:bg-lira-blue-hover">
          Close
        </button>
      </div>
    </div>
  );
}
