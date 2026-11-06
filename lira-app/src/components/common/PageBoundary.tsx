import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Wraps one page. If the page crashes, only that page is replaced by a message (the sidebar and top bar keep working),
 * and moving to another page clears the error because `pageKey` changes.
 */
export function PageBoundary({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      key={pageKey}
      fallback={({ error, reset }) => (
        <div className="flex-1 flex items-center justify-center bg-jira-bg p-6" role="alert">
          <div className="max-w-md text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
            <h2 className="text-lg font-semibold text-jira-text">This page hit a problem</h2>
            <p className="text-sm text-jira-muted">The rest of Lira is fine. You can try again, or go somewhere else from the sidebar.</p>
            {error?.message && <pre className="text-[11px] text-left bg-jira-surface border border-jira-border rounded-lg p-3 text-jira-muted whitespace-pre-wrap max-h-28 overflow-auto">{error.message}</pre>}
            <div className="flex items-center justify-center gap-2">
              <button onClick={reset} className="px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-jira-blue-hover cursor-pointer">Try again</button>
              <Link to="/" className="px-4 py-2 text-sm font-medium border border-jira-border rounded-lg text-jira-text hover:bg-jira-surface">Go home</Link>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Shown when a link points at something that does not exist (a deleted project, an unknown space). */
export function NotFound({ what, backTo, backLabel }: { what: string; backTo: string; backLabel: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-jira-bg p-6">
      <div className="max-w-sm text-center space-y-3">
        <div className="text-4xl">🧭</div>
        <h2 className="text-lg font-semibold text-jira-text">{what} was not found</h2>
        <p className="text-sm text-jira-muted">It may have been deleted, or the link may be wrong.</p>
        <Link to={backTo} className="inline-block px-4 py-2 text-sm font-semibold bg-jira-blue text-white rounded-lg hover:bg-jira-blue-hover">{backLabel}</Link>
      </div>
    </div>
  );
}
