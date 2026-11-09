import { Share2, EyeOff, Archive } from 'lucide-react';
import { StandupButton } from '../../standup/StandupButton';
import type { ActionBarState } from './useActionBarState';

/** Space name, standup, share and quick actions. */
export function SpaceHeader(s: ActionBarState) {
  const { space, isSpaceHidden, isSpaceArchived, setShowShare } = s;
  return (
    <>
      {/* Space header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          {space && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: space.color + '22', color: space.color }}
            >
              {space.icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-lira-text leading-tight">
                {space?.name || 'Select a space'}
              </h1>
              {isSpaceHidden && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold shadow-2xs">
                  <EyeOff className="w-3 h-3 text-amber-600" />
                  Hidden Space
                </span>
              )}
              {isSpaceArchived && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-semibold shadow-2xs">
                  <Archive className="w-3 h-3 text-slate-600" />
                  Archived Space
                </span>
              )}
            </div>
            {space?.description && (
              <p className="text-xs text-lira-muted truncate max-w-xs">{space.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {space?.id && (
            <StandupButton scope={{ type: 'space', id: `space:${space.id}`, name: space.name, spaceId: space.id }} />
          )}
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-lira-text border border-lira-border rounded hover:bg-gray-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>
    </>
  );
}
