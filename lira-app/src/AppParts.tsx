/** The loading screen while the app starts. */
export function StartupScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-lira-bg">
      <div className="text-center space-y-3">
        <img src="/lira-logo.png" alt="Lira Logo" className="w-16 h-16 mx-auto animate-pulse object-contain" />
        <p className="text-lira-muted text-sm font-medium">Initializing Lira v2.0…</p>
      </div>
    </div>
  );
}

/** Shown instead of the ticket popup when it crashes while drawing. Clicking anywhere or Close dismisses it. */
export function IssueCrashFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-modal">
        <p className="text-lg font-semibold text-lira-text mb-2">Failed to render this issue</p>
        <p className="text-sm text-lira-muted mb-4">There was an error displaying the issue details.</p>
        <button onClick={onClose} className="px-4 py-2 bg-lira-blue text-lira-on-blue rounded-lg text-sm font-medium hover:bg-lira-blue-hover">
          Close
        </button>
      </div>
    </div>
  );
}
