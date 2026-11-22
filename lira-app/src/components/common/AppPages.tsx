import { LiraLogo } from './LiraLogo';

/** Shown when there are no spaces at all. */
export function NoSpaces({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="group flex items-center justify-center gap-3 text-lira-text">
          <LiraLogo className="w-14 h-14" />
          <span className="text-4xl font-bold tracking-tight">Liraspaces</span>
        </div>
        <p className="text-lira-muted text-sm">Select a space or create one to get started.</p>
        <button onClick={onCreate} className="px-5 py-2.5 bg-lira-blue text-lira-on-blue rounded-lg text-sm font-medium hover:bg-lira-blue-hover transition-colors cursor-pointer">
          Create your first space
        </button>
      </div>
    </div>
  );
}
