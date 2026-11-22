import { LiraLogo } from './LiraLogo';

/** A grey block that stands in for content that has not arrived yet. It is hidden from screen readers; the wrapper says what is loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden data-skeleton className={`rounded bg-lira-border/70 animate-skeleton ${className}`} />;
}

const COLUMNS = [3, 2, 3, 1];

/**
 * The whole app as grey shapes: the top bar, the sidebar and four board columns. Shown while Lira starts, so the page keeps its
 * shape and nothing jumps when the real screen arrives. `label` is read out by screen readers.
 */
export function AppSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="h-screen flex flex-col gap-2 p-2 bg-app-frame overflow-hidden">
      <span className="sr-only">{label}</span>
      <div className="h-14 rounded-xl bg-lira-nav flex items-center gap-3 px-3 text-white flex-shrink-0">
        <LiraLogo className="w-7 h-7" motion="loop" />
        <Skeleton className="h-4 w-24 !bg-white/15" />
        <Skeleton className="h-9 flex-1 max-w-md ml-4 !bg-white/10" />
      </div>
      <div className="flex flex-1 gap-2 min-h-0">
        <div className="hidden md:flex w-[264px] flex-shrink-0 rounded-xl bg-lira-nav flex-col gap-3 p-4">
          {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-5 !bg-white/10" />)}
        </div>
        <div className="flex-1 min-w-0 rounded-xl border border-lira-border bg-lira-bg p-5 flex flex-col gap-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="flex gap-4 flex-1 min-h-0 mt-2">
            {COLUMNS.map((cards, c) => (
              <div key={c} className="flex-1 min-w-0 flex flex-col gap-3">
                <Skeleton className="h-5 w-24" />
                {Array.from({ length: cards }, (_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The inside of a page while its code is fetched: a title and a grid of cards. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex-1 p-6 flex flex-col gap-5 overflow-hidden">
      <span className="sr-only">Loading the page</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  );
}
