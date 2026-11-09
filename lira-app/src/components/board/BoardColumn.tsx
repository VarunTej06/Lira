import React, { useState, useEffect } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Plus, AlertCircle } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { IssueCard } from './IssueCard';
import { PALETTE } from '../../theme/palette';
import { appStorage } from '../../utils/appStorage';

interface BoardColumnProps {
  id: string;
  title: string;
  issues: Issue[];
  allIssues?: Issue[];
  space?: Space;
  onIssueClick: (issue: Issue) => void;
  onAddIssue: (status: string) => void;
  accentColor?: string;
  minHeight?: number;
  wipLimit?: number;
}

const COLUMN_HEADER_STYLES: Record<string, { color: string; bg: string; dot: string }> = {
  backlog: { color: PALETTE.textMuted, bg: PALETTE.surfaceMuted, dot: PALETTE.textMuted },
  todo: { color: PALETTE.textStrong, bg: PALETTE.border, dot: PALETTE.textStrong },
  inprogress: { color: PALETTE.brand, bg: PALETTE.brandBg, dot: PALETTE.amber },
  done: { color: '#006644', bg: '#E3FCEF', dot: PALETTE.success },
};

export const BoardColumn: React.FC<BoardColumnProps> = ({
  id,
  title,
  issues,
  allIssues,
  space,
  onIssueClick,
  onAddIssue,
  accentColor,
  minHeight,
  wipLimit: propWipLimit,
}) => {
  const style = COLUMN_HEADER_STYLES[id] || COLUMN_HEADER_STYLES.todo;

  // Read WIP limit configuration (object { [columnName]: number } or fallback)
  const [internalLimit, setInternalLimit] = useState<number | undefined>(() => {
    try {
      const raw = appStorage.get('lira_wip_limits');
      if (raw && raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        return parsed[id] || parsed[title] || parsed[id.toLowerCase()];
      }
      return undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const raw = appStorage.get('lira_wip_limits');
        if (raw && raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          setInternalLimit(parsed[id] || parsed[title] || parsed[id.toLowerCase()]);
        } else {
          setInternalLimit(undefined);
        }
      } catch {
        setInternalLimit(undefined);
      }
    };
    window.addEventListener('lira_wip_limits_changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('lira_wip_limits_changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, [id, title]);

  const activeLimit = propWipLimit !== undefined ? propWipLimit : internalLimit;
  const isExceeded = activeLimit !== undefined && activeLimit > 0 && issues.length > activeLimit;

  return (
    <div className={`flex flex-col w-[300px] min-w-[300px] max-w-[300px] flex-shrink-0 self-stretch rounded-xl transition-all ${
      isExceeded ? 'ring-2 ring-red-400 bg-red-50/20' : ''
    }`}>
      {/* Column Header */}
      <div className="flex items-center justify-between px-2 py-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: accentColor || style.dot }}
          />
          <span className="text-sm font-semibold text-lira-text truncate">{title}</span>

          {activeLimit !== undefined && activeLimit > 0 ? (
            <span
              className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full flex-shrink-0 flex items-center gap-1 transition-all ${
                isExceeded ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-300' : 'bg-gray-200 text-gray-700'
              }`}
              title={isExceeded ? `WIP limit exceeded! (${issues.length} / ${activeLimit})` : `WIP Limit: ${issues.length} / ${activeLimit}`}
            >
              {isExceeded && <AlertCircle className="w-3 h-3" />}
              {issues.length} / {activeLimit}
            </span>
          ) : (
            <span
              className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full flex-shrink-0"
              style={{ color: style.color, backgroundColor: style.bg }}
            >
              {issues.length}
            </span>
          )}
        </div>

        {/* Top-right Add Issue button aligned with heading */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddIssue(id);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-lira-muted hover:text-lira-blue hover:bg-white/80 hover:shadow-2xs border border-transparent hover:border-lira-border transition-all cursor-pointer flex-shrink-0 group"
          title={`Add issue to ${title}`}
          aria-label={`Add issue to ${title}`}
        >
          <Plus className="w-3.5 h-3.5 text-lira-muted group-hover:text-lira-blue transition-colors" />
          <span className="group-hover:text-lira-blue transition-colors">Add</span>
        </button>
      </div>

      {/* Drop zone container spanning full column height */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{ minHeight: `${minHeight || 650}px` }}
            className={`
              flex flex-col gap-2.5 p-2 rounded-xl transition-colors duration-150 flex-1 w-full
              ${snapshot.isDraggingOver
                ? 'bg-blue-50/95 border-2 border-dashed border-lira-blue/70 shadow-xs ring-2 ring-lira-blue/20'
                : 'bg-[#091E4206] hover:bg-[#091E420A] border-2 border-transparent'
              }
            `}
          >
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                space={space}
                allIssues={allIssues}
                onClick={onIssueClick}
              />
            ))}
            {provided.placeholder}

            {/* Empty column placeholder */}
            {issues.length === 0 && !snapshot.isDraggingOver && (
              <div
                onClick={() => onAddIssue(id)}
                className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-gray-200 hover:border-lira-blue/50 hover:bg-blue-50/20 rounded-xl text-center cursor-pointer transition-all group my-1 select-none flex-1 min-h-[140px]"
                role="button"
                tabIndex={0}
              >
                <span className="text-xs text-lira-muted group-hover:text-lira-blue font-medium">
                  No {title.toLowerCase()} issues
                </span>
                <span className="text-xs text-lira-blue mt-1.5 font-semibold flex items-center gap-1 group-hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add issue
                </span>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};
