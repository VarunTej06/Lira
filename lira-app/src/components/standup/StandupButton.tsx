import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { StandupModal } from './StandupModal';
import { CALL_SHORT, CALL_TITLE, type StandupScope } from '../../utils/standupUtils';

interface StandupButtonProps {
  scope: StandupScope;
  className?: string;
  /** Hide the text label and show only the icon. */
  compact?: boolean;
  /** Large filled button for places where it should stand out. */
  prominent?: boolean;
}

/** One-click entry to the standup hub for a space, project or sprint. */
export const StandupButton: React.FC<StandupButtonProps> = ({ scope, className = '', compact, prominent }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${CALL_TITLE[scope.type]}: agenda, schedule and invite the team`}
        className={`flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
          prominent
            ? 'px-4 py-2.5 text-sm font-semibold text-lira-on-blue bg-lira-blue border border-lira-blue hover:bg-lira-blue-hover'
            : 'px-3 py-1.5 text-xs font-medium text-lira-text border border-lira-border hover:bg-gray-50 hover:border-lira-blue'
        } ${className}`}
      >
        <Video className={prominent ? 'w-4 h-4' : 'w-3.5 h-3.5 text-lira-blue'} />
        {!compact && (prominent ? `Schedule ${CALL_SHORT[scope.type].toLowerCase()}` : CALL_SHORT[scope.type])}
        <span className={`text-4xs font-bold uppercase px-1 py-px rounded ${prominent ? 'bg-white/25 text-white' : 'bg-lira-blue-light text-lira-blue'}`}>Beta</span>
      </button>
      {open && <StandupModal isOpen={open} onClose={() => setOpen(false)} scope={scope} />}
    </>
  );
};
