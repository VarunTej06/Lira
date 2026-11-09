import React from 'react';
import { CalendarPlus, Users, ListChecks } from 'lucide-react';
import { Modal } from '../common/Modal';
import { CALL_TITLE, type StandupScope } from '../../utils/standupUtils';
import { AgendaTab } from './AgendaTab';
import { ScheduleTab } from './ScheduleTab';
import { TeamTab } from './TeamTab';
import { useStandup, type Tab } from './useStandup';

interface StandupModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: StandupScope;
}

const SCOPE_LABEL = { space: 'Space', project: 'Project', sprint: 'Sprint' };

/** Standup hub: today's agenda from live tickets, plus scheduling a recurring call with calendar invites for the team. */
export const StandupModal: React.FC<StandupModalProps> = ({ isOpen, onClose, scope }) => {
  const s = useStandup(isOpen, scope, onClose);
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'agenda', label: 'Agenda', icon: <ListChecks className="w-3.5 h-3.5" /> },
    { id: 'schedule', label: 'Schedule & invite', icon: <CalendarPlus className="w-3.5 h-3.5" /> },
    { id: 'team', label: `Team (${s.members.length})`, icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={CALL_TITLE[scope.type]} size="xl">
      <div className="flex flex-col max-h-[78vh]">
        <div className="px-6 pt-4 pb-3 border-b border-lira-border flex flex-wrap items-center gap-3">
          <span className="text-3xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-blue-50 text-lira-blue">{SCOPE_LABEL[scope.type]}</span>
          <h2 className="text-base font-semibold text-lira-text truncate">{scope.name}</h2>
          <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Beta</span>
          <span className="text-xs text-lira-muted ml-auto">{s.scoped.length} tickets · {s.members.length} people</span>
        </div>

        <div className="px-6 flex gap-1 border-b border-lira-border">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => s.setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${s.tab === id ? 'text-lira-blue border-lira-blue' : 'text-lira-muted border-transparent hover:text-lira-text'}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {s.msg && <div className="mx-6 mt-3 text-xs rounded-xl bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2">{s.msg}</div>}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {s.tab === 'agenda' && <AgendaTab {...s} />}
          {s.tab === 'schedule' && <ScheduleTab {...s} />}
          {s.tab === 'team' && <TeamTab {...s} />}
        </div>
      </div>
    </Modal>
  );
};
