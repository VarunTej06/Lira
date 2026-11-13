import React, { useMemo, useState } from 'react';
import { ArrowRightCircle, AlertTriangle } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import {
  allSprintKeys, burndown, currentSprintKey, followingSprint, getIssueSprint, getSprintMeta, getSprintSpaces, setSprintSpaces,
  isDone, isSprintWork, issuesInSprint, moveIssuesToSprint, sprintLabel, sprintName, sprintPhase,
} from '../../utils/sprintUtils';
import { SprintSelect } from './sprintParts';
import { SprintPlanning } from './SprintPlanning';
import { SprintReports } from './SprintReports';
import { EpicTimeline } from './EpicTimeline';
import { CloseSprintModal } from './CloseSprintModal';
import { RetroCard } from './RetroCard';
import { type SprintFilterValue } from './sprintFilterDefaults';
import { EMPTY_FILTER } from './sprintFilterDefaults';
import { SprintSpacesPicker } from './SprintSpacesPicker';
import { SprintPageHeader } from './SprintPageHeader';
import { SprintStrip } from './SprintStrip';
import { SprintSummary } from './SprintSummary';
import { SprintTicketBox } from './SprintTicketBox';
import { BurndownChart, VelocityChart } from './SprintCharts';
import { Modal } from '../common/Modal';
import { Toast } from '../common/motion';
import { motion } from '../common/motionPresets';
import { slide } from '../common/motionPresets';
import { useResetWhen } from '../../hooks/useResetWhen';
import { useFlash } from '../../hooks/useFlash';
import { sprintVelocity } from '../../utils/sprintVelocity';

type View = 'sprint' | 'planning' | 'reports' | 'epics';
const VIEWS: { id: View; label: string }[] = [
  { id: 'sprint', label: 'Sprint' },
  { id: 'planning', label: 'Planning' },
  { id: 'reports', label: 'Reports' },
  { id: 'epics', label: 'Epics' },
];

interface SprintsPageProps {
  spaces: Space[];
  issues: Issue[];
  /** When set, the page is locked to one space (used by a space's "Sprints" tab). */
  lockedSpaceId?: number;
  onIssueClick: (issue: Issue) => void;
  onOpenSpace?: (spaceId: number) => void;
  /** Create a ticket in the sprint being viewed; spaceId is set only when the page is scoped to one space. */
  onAddIssue?: (status: string, opts?: { sprint: string; spaceId?: number }) => void;
  onOpenAllTickets?: () => void;
  /** Jump to this sprint (e.g. when picked from the sidebar). */
  focusSprint?: string;
  onCreateSprint?: () => void;
  /** Shows a "← All sprints" link back to the overview. */
  onBack?: () => void;
}

/** This sprint has ended and still has unfinished tickets: offer to carry them over. */
function RolloverPrompt({ sprint, keys, unfinished, onCarryOver }: { sprint: string; keys: string[]; unfinished: Issue[]; onCarryOver: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-lira-blue-light border border-lira-border rounded-lg px-4 py-3" role="status" data-testid="rollover-prompt">
      <ArrowRightCircle className="w-4 h-4 text-lira-blue flex-shrink-0" />
      <p className="text-sm text-lira-text flex-1">
        {sprintName(sprint)} ended with <strong>{unfinished.length}</strong> unfinished ticket{unfinished.length > 1 ? 's' : ''}. Carry {unfinished.length > 1 ? 'them' : 'it'} over to {sprintName(followingSprint(sprint, keys))}?
      </p>
      <button onClick={onCarryOver} className="text-xs font-medium px-3 py-1.5 rounded bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer">Carry over and close</button>
    </div>
  );
}

/** Unfinished tickets are still sitting in sprints that have already ended. */
function StrandedPrompt({ count, onMove }: { count: number; onMove: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-sm text-amber-800 flex-1">
        <strong>{count}</strong> unfinished ticket{count > 1 ? 's are' : ' is'} still sitting in sprints that have already ended.
      </p>
      <button onClick={onMove} className="text-xs font-medium px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 cursor-pointer">
        Move to {sprintLabel(currentSprintKey(), true)}
      </button>
    </div>
  );
}

/** Sprint, Planning, Reports and Epics. */
function ViewTabs({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
  <div className="flex gap-1 border-b border-lira-border" role="tablist" aria-label="Sprint views">
    {VIEWS.map(v => (
      <button
        key={v.id}
        role="tab"
        aria-selected={view === v.id}
        onClick={() => onChange(v.id)}
        className={`relative px-4 py-2 text-sm font-medium -mb-px border-b-2 border-transparent cursor-pointer transition-colors ${view === v.id ? 'text-lira-blue' : 'text-lira-muted hover:text-lira-text'}`}
      >
        {v.label}
        {view === v.id && <motion.span layoutId="sprint-view-underline" transition={slide} className="absolute left-0 right-0 -bottom-[2px] h-0.5 rounded-full bg-lira-blue" aria-hidden />}
      </button>
    ))}
  </div>
  );
}

/** Shown while tickets are ticked: move them to another sprint, or clear the selection. */
function BulkMoveBar({ count, sprint, keys, onMove, onClear }: { count: number; sprint: string; keys: string[]; onMove: (target: string) => void; onClear: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 bg-lira-blue text-lira-on-blue rounded-lg px-4 py-2 shadow-md">
      <span className="text-sm font-medium">{count} selected</span>
      <span className="text-xs opacity-80">Move to</span>
      <SprintSelect value="all" options={keys} onChange={v => v !== 'all' && onMove(v)} allLabel="Choose sprint…" className="text-lira-text" />
      <button onClick={() => onMove(followingSprint(sprint, keys))} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 cursor-pointer">
        <ArrowRightCircle className="w-3.5 h-3.5" /> Next sprint
      </button>
      <button onClick={onClear} className="ml-auto text-xs underline cursor-pointer">Clear</button>
    </div>
  );
}

/** Buttons that jump to each space that has tickets in the sprint. */
function SpaceShortcuts({ spaces, list, onOpenSpace }: { spaces: Space[]; list: Issue[]; onOpenSpace: (spaceId: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-lira-muted items-center">
      Jump to a space:
      {spaces.filter(s => list.some(i => i.spaceId === s.id)).map(s => (
        <button key={s.id} onClick={() => onOpenSpace(s.id!)} className="px-2 py-1 rounded border border-lira-border bg-white hover:bg-gray-50 text-lira-text cursor-pointer">
          {s.icon} {s.name} ({list.filter(i => i.spaceId === s.id).length})
        </button>
      ))}
    </div>
  );
}

/** Choose which spaces can add tickets to the sprint from now on. */
function SprintSpacesModal({ isOpen, sprint, spaces, draft, onDraft, onClose, onSaved }: { isOpen: boolean; sprint: string; spaces: Space[]; draft: number[]; onDraft: (ids: number[]) => void; onClose: () => void; onSaved: () => void }) {
  return (
  <Modal isOpen={isOpen} onClose={onClose} title={`Spaces in ${sprintName(sprint)}`} size="md">
    <div className="p-6 space-y-4">
      <SprintSpacesPicker spaces={spaces} value={draft} onChange={onDraft} />
      <p className="text-2xs text-lira-muted">Tickets already in the sprint stay. This decides which spaces can add tickets from now on.</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg border border-lira-border bg-white cursor-pointer">Cancel</button>
        <button
          onClick={() => { setSprintSpaces(sprint, draft.length && draft.length < spaces.length ? draft : null); onClose(); onSaved(); }}
          className="text-sm px-3 py-1.5 rounded-lg bg-lira-blue text-lira-on-blue cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  </Modal>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export const SprintsPage: React.FC<SprintsPageProps> = ({
  spaces, issues, lockedSpaceId, onIssueClick, onOpenSpace, onAddIssue, onOpenAllTickets, focusSprint, onCreateSprint, onBack,
}) => {
  const [scope, setScope] = useState<'all' | number>(lockedSpaceId ?? 'all');
  const [sprint, setSprint] = useState(currentSprintKey());
  const [view, setView] = useState<View>('sprint');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<SprintFilterValue>(EMPTY_FILTER);
  const [boxCollapsed, setBoxCollapsed] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [retroVersion, setRetroVersion] = useState(0);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [spacesDraft, setSpacesDraft] = useState<number[]>([]);
  const { message: toast, flash } = useFlash();

  useResetWhen([lockedSpaceId], () => { if (lockedSpaceId) setScope(lockedSpaceId); });
  useResetWhen([focusSprint], () => { if (focusSprint) setSprint(focusSprint); });
  useResetWhen([sprint, scope], () => { setSelected(new Set()); setFilter(EMPTY_FILTER); });

  const spaceById = useMemo(() => new Map(spaces.map(s => [s.id!, s])), [spaces]);

  // Everything below is limited to the chosen space (or all spaces)
  const scoped = useMemo(() => issues.filter(i => isSprintWork(i) && (scope === 'all' || i.spaceId === scope)), [issues, scope]);
  const keys = useMemo(() => allSprintKeys(scoped), [scoped]);
  const list = useMemo(() => issuesInSprint(scoped, sprint), [scoped, sprint]);
  const phase = sprintPhase(sprint);
  const meta = getSprintMeta(scope, sprint);
  const unfinished = list.filter(i => !isDone(i));
  const selectedIssues = list.filter(i => selected.has(i.id!));

  // Open tickets stranded in sprints that already ended
  const stranded = useMemo(() => scoped.filter(i => !isDone(i) && sprintPhase(getIssueSprint(i)) === 'past'), [scoped]);

  const velocity = useMemo(() => sprintVelocity(keys, scoped), [keys, scoped]);
  const burn = useMemo(() => burndown(list, sprint), [list, sprint]);

  const involved = getSprintSpaces(sprint);
  const involvedSpaces = involved ? spaces.filter(s => involved.includes(s.id!)) : null;

  const rescueStranded = async () => {
    const moved = await moveIssuesToSprint(stranded, currentSprintKey());
    flash(`${plural(moved, 'stranded ticket')} moved to ${sprintName(currentSprintKey())}`);
  };
  const bulkMove = async (target: string) => {
    const moved = await moveIssuesToSprint(selectedIssues, target);
    setSelected(new Set());
    flash(`${plural(moved, 'ticket')} moved to ${sprintName(target)}`);
  };
  const bumpRetro = () => setRetroVersion(v => v + 1);
  const toggleBoxCollapsed = () => setBoxCollapsed(c => !c);

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <SprintPageHeader
          spaces={spaces} scope={scope} onScopeChange={setScope} lockedSpaceId={lockedSpaceId} sprint={sprint}
          onBack={onBack} onCreateSprint={onCreateSprint} onOpenAllTickets={onOpenAllTickets}
        />

        <SprintStrip sprint={sprint} keys={keys} scoped={scoped} onPick={setSprint} />

        {/* Rollover prompt: this sprint has ended and still has unfinished tickets */}
        {phase === 'past' && !meta.completedAt && unfinished.length > 0 && (
          <RolloverPrompt sprint={sprint} keys={keys} unfinished={unfinished} onCarryOver={() => setCloseOpen(true)} />
        )}

        {stranded.length > 0 && <StrandedPrompt count={stranded.length} onMove={rescueStranded} />}

        <SprintSummary
          sprint={sprint} scope={scope} keys={keys} list={list}
          involvedNames={involvedSpaces ? involvedSpaces.map(s => s.name) : null} involvedCount={involved?.length}
          onEditSpaces={() => { setSpacesDraft(involved ?? []); setSpacesOpen(true); }}
          onAddIssue={onAddIssue} onComplete={() => setCloseOpen(true)} onGoalSaved={bumpRetro}
        />

        <ViewTabs view={view} onChange={setView} />

        <motion.div key={view} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={slide} className="space-y-5">
          {view === 'planning' && <SprintPlanning issues={issues} spaces={spaces} sprint={sprint} keys={keys} scope={scope} onIssueClick={onIssueClick} flash={flash} />}
          {view === 'reports' && <SprintReports key={`${sprint}-${scope}`} issues={issues} sprint={sprint} scope={scope} onIssueClick={onIssueClick} />}
          {view === 'epics' && <EpicTimeline issues={issues} keys={keys} scope={scope} sprint={sprint} onIssueClick={onIssueClick} onPickSprint={k => { setSprint(k); setView('sprint'); }} />}

          {view === 'sprint' && (
            <>
              <RetroCard sprint={sprint} scope={scope} version={retroVersion} onEdit={() => setCloseOpen(true)} onChanged={bumpRetro} />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white border border-lira-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-lira-text mb-2">Burndown</h3>
                  <BurndownChart key={`${sprint}-${scope}`} data={burn} total={list.length} />
                </div>
                {/* keyed by sprint so the bars grow again when you switch sprint */}
                <div className="bg-white border border-lira-border rounded-lg p-4">
                  <VelocityChart key={`${sprint}-${scope}`} velocity={velocity} sprint={sprint} onPick={setSprint} />
                </div>
              </div>

              {selectedIssues.length > 0 && (
                <BulkMoveBar count={selectedIssues.length} sprint={sprint} keys={keys} onMove={bulkMove} onClear={() => setSelected(new Set())} />
              )}

              <SprintTicketBox
                sprint={sprint} scope={scope} keys={keys} list={list} phase={phase}
                filterSpaces={involvedSpaces ?? spaces} spaceById={spaceById} filter={filter} onFilterChange={setFilter}
                selected={selected} setSelected={setSelected} collapsed={boxCollapsed} onToggleCollapsed={toggleBoxCollapsed}
                onIssueClick={onIssueClick}
              />

              {scope === 'all' && onOpenSpace && list.length > 0 && <SpaceShortcuts spaces={spaces} list={list} onOpenSpace={onOpenSpace} />}
            </>
          )}
        </motion.div>
      </div>

      <SprintSpacesModal isOpen={spacesOpen} sprint={sprint} spaces={spaces} draft={spacesDraft} onDraft={setSpacesDraft} onClose={() => setSpacesOpen(false)} onSaved={() => flash('Sprint spaces updated')} />

      <CloseSprintModal
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
        sprint={sprint}
        scope={scope}
        list={list}
        keys={keys}
        onSaved={msg => { flash(msg); bumpRetro(); }}
      />

      <Toast message={toast} />
    </div>
  );
};
