import { sprintLink } from '../../../utils/links';
import { confirmDialog } from '../../common/dialogs';
import { Trash2, CalendarClock } from 'lucide-react';
import { RowMenuButton, ContextItem, SectionHeader, Collapsible } from './parts';
import { canDeleteSprint, sprintLabel, sprintName, sprintPhase } from '../../../utils/sprintUtils';
import type { SidebarState } from './useSidebarState';

/** The Sprints list. */
export function SprintsSection(s: SidebarState) {
  const { sprintKeys, sprintCounts, activeSprint, onSelectSprint, onCreateSprint, onDeleteSprint, activeTab, sprintsExpanded, setSprintsExpanded, showAllSprints, setShowAllSprints, rowMenu, setRowMenu, visibleSprintKeys } = s;
  return (
    <>
      {/* ── Sprints Section ── */}
      <div className="py-2 border-b border-white/10">
        <SectionHeader
          title="Sprints"
          count={sprintKeys.length}
          expanded={sprintsExpanded}
          onToggle={() => setSprintsExpanded(!sprintsExpanded)}
          onAdd={onCreateSprint}
          addTitle="New sprint"
        />
        <Collapsible open={sprintsExpanded}>
          <div className="mt-0.5 px-2 space-y-0.5">
            {visibleSprintKeys.map(k => {
              const phase = sprintPhase(k);
              const c = sprintCounts[k] || { done: 0, total: 0 };
              const active = activeSprint === k && activeTab === 'SprintDetail';
              return (
                <div key={k} className="relative group" data-menu-root={`sprint:${k}`}>
                  <button
                    onClick={() => { setRowMenu(null); onSelectSprint?.(k); }} {...sprintLink(k)}
                    title={sprintName(k)}
                    data-active={active ? 'true' : undefined}
                    className={`w-full flex items-center gap-2.5 pl-2.5 pr-2.5 group-hover:pr-8 py-1.5 rounded-xl text-left text-xs transition-all duration-200 cursor-pointer ${
                      active ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        phase === 'active' ? 'bg-green-400' : phase === 'upcoming' ? 'bg-sky-400' : 'bg-white/30'
                      }`}
                    />
                    <span className="truncate flex-1">{sprintLabel(k)}</span>
                    {phase === 'active' && <span className="text-[9px] font-bold text-green-300">ACTIVE</span>}
                    <span className="text-[10px] text-white/40 tabular-nums">{c.done}/{c.total}</span>
                  </button>
                  <RowMenuButton
                    open={rowMenu === `sprint:${k}`}
                    onToggle={() => setRowMenu(rowMenu === `sprint:${k}` ? null : `sprint:${k}`)}
                    label="Sprint actions"
                    menuKey={`sprint:${k}`}
                  >
                    <ContextItem icon={<CalendarClock className="w-3.5 h-3.5 text-teal-400" />} label="Open sprint" onClick={() => { setRowMenu(null); onSelectSprint?.(k); }} />
                    <div className="border-t border-white/10 my-1" />
                    {canDeleteSprint(k) ? (
                      <ContextItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label="Delete sprint"
                        danger
                        onClick={() => {
                          setRowMenu(null);
                          const msg = c.total > 0
                            ? `Delete the ${sprintName(k)}?\n\nIts ${c.total} ${c.total === 1 ? 'ticket moves' : 'tickets move'} to the current sprint (${c.done} done). Nothing else is deleted.`
                            : `Delete the ${sprintName(k)}? It has no tickets.`;
                          void confirmDialog({ title: 'Delete sprint', message: msg, confirmLabel: 'Delete sprint', tone: 'danger' }).then(ok => { if (ok) onDeleteSprint?.(k); });
                        }}
                      />
                    ) : (
                      <div className="px-3 py-2 text-[11px] text-white/40 leading-snug max-w-[200px]">The current and next sprints always exist, so they cannot be deleted.</div>
                    )}
                  </RowMenuButton>
                </div>
              );
            })}
            {sprintKeys.length > visibleSprintKeys.length || showAllSprints ? (
              <button
                onClick={() => setShowAllSprints(v => !v)}
                className="w-full text-left px-2.5 py-1 text-[11px] text-white/40 hover:text-white/70 cursor-pointer"
              >
                {showAllSprints ? 'Show fewer' : `Show all ${sprintKeys.length} sprints`}
              </button>
            ) : null}
          </div>
        </Collapsible>
      </div>
    </>
  );
}
