import { RichTextEditor } from '../common/richtext/RichTextEditor';
import { DatePicker } from '../common/DatePicker';
import { Zap } from 'lucide-react';
import { TypeIcon } from '../common/Icons';
import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TicketSuggestions } from './TicketSuggestions';
import type { Space } from '../../types/space';
import { createIssue, getNextIssueKey, useIssuesBySpace } from '../../hooks/useIssues';
import type { Priority, IssueType, Issue } from '../../types/issue';
import { buildNewIssue } from '../../utils/newIssue';
import { currentSprintKey, sprintName } from '../../utils/sprintUtils';
import { NO_ISSUES } from '../../utils/emptyLists';
import { useResetWhen } from '../../hooks/useResetWhen';
import { useCreateIssueFields } from './useCreateIssueFields';
import { appendLabel, effectiveSprint, missingForTicket, parentCandidates, parentPlaceholder, sprintChoices, sprintsOpenTo } from './createIssueForm';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  defaultStatus?: string;
  /** Spaces offered in the picker (only used with chooseSpace). */
  spaces?: Space[];
  /** Ask which space the ticket belongs to instead of using `space`. */
  chooseSpace?: boolean;
  /** Sprint pre-selected when the modal opens. */
  defaultSprint?: string;
}

const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'epic', label: 'Epic' },
  { value: 'subtask', label: 'Subtask' },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'highest', label: 'Highest' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
];

const INPUT = 'w-full text-sm border border-lira-border rounded-lg px-3 focus:outline-none focus:border-lira-blue transition-all';
const SELECT = 'w-full text-sm border border-lira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-lira-blue bg-white';
const LABEL = 'block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide';
const STATUSES = [['backlog', 'Backlog'], ['todo', 'To Do'], ['inprogress', 'In Progress'], ['done', 'Done']];

const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className={LABEL}>{label}{required && <> <span className="text-red-500">*</span></>}</label>
    {children}
  </div>
);

/** Which space gets the ticket, when the dialog was opened from a page that spans spaces. */
function SpacePicker({ spaces, value, onChange }: { spaces: Space[]; value: number | undefined; onChange: (id: number | undefined) => void }) {
  return (
    <div>
      <label className={LABEL}>Space <span className="text-red-500">*</span></label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
        autoFocus={!value}
        className={`${SELECT} cursor-pointer`}
      >
        <option value="">Select a space…</option>
        {spaces.map(s => <option key={s.id} value={s.id}>{s.name} ({s.key})</option>)}
      </select>
    </div>
  );
}

/** Task, bug, epic or subtask. */
function TypePicker({ type, onChange }: { type: IssueType; onChange: (type: IssueType) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-lira-muted mb-2 uppercase tracking-wide">Issue Type</label>
      <div className="flex gap-2">
        {ISSUE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all ${
              type === t.value
                ? 'border-lira-blue bg-lira-blue-light text-lira-blue font-semibold'
                : 'border-lira-border text-lira-muted hover:border-gray-300 hover:text-lira-text'
            }`}
          >
            <TypeIcon type={t.value} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The epic (for a task or bug) or the parent task (for a subtask). Epics have no parent. */
function ParentPicker({ type, space, candidates, value, onChange }: { type: IssueType; space: Space | undefined; candidates: Issue[]; value: number | undefined; onChange: (id: number | undefined) => void }) {
  if (type === 'epic') {
    return (
      <p className="text-xs text-lira-muted bg-gray-50 border border-lira-border rounded-xl px-3 py-2">
        <Zap className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-purple-600" /> Epics are top-level — they don't link to a parent. Choose the space above.
      </p>
    );
  }
  return (
    <div>
      <label className={LABEL}>
        {type === 'subtask' ? 'Parent task' : 'Epic'}{' '}
        {type === 'subtask' ? <span className="text-red-500">*</span> : <span className="normal-case font-normal">(optional)</span>}
      </label>
      <select
        value={value || ''}
        disabled={!space}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className={`${SELECT} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <option value="">{parentPlaceholder(type, space, candidates.length)}</option>
        {candidates.map(p => <option key={p.id} value={p.id}>{p.key} — {p.title}</option>)}
      </select>
    </div>
  );
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  space: spaceProp,
  defaultStatus = 'todo',
  spaces = [],
  chooseSpace = false,
  defaultSprint,
}) => {
  // When opened from a cross-space page (e.g. Sprints), the user picks which space gets the ticket
  const [pickedSpaceId, setPickedSpaceId] = useState<number | undefined>(undefined);
  // The space is always chosen explicitly; it is pre-selected when the caller already has a space in context.
  const space = spaces.length > 0 ? spaces.find(s => s.id === pickedSpaceId) : spaceProp;
  const { title, setTitle, description, setDescription, attachments, setAttachments, type, setType, status, setStatus, parentId, setParentId,
    priority, setPriority, dueDate, setDueDate, labels, setLabels, sprint, setSprint, error, setError, clearFields } = useCreateIssueFields(defaultStatus);
  const openSprints = sprintsOpenTo(sprintChoices(defaultSprint), space?.id);
  const sprintValue = effectiveSprint(sprint, openSprints);
  const [loading, setLoading] = useState(false);

  const spaceIssues = useIssuesBySpace(space?.id) ?? NO_ISSUES;

  // Sync status when defaultStatus changes
  useResetWhen([isOpen, defaultStatus, defaultSprint, chooseSpace, spaceProp?.id], () => {
    if (isOpen) {
      setStatus(defaultStatus);
      setSprint(defaultSprint || currentSprintKey());
      setPickedSpaceId(chooseSpace ? undefined : spaceProp?.id);
      setParentId(undefined);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = missingForTicket({ title, hasSpace: !!space?.id, type, parentId });
    if (missing) { setError(missing); return; }

    setLoading(true);
    setError('');

    try {
      const newIssue = buildNewIssue({
        spaceId: space!.id!, key: await getNextIssueKey(space!.key), title, description, type, status, priority, dueDate, labels,
        sprint: sprintValue, parentId, attachments, spaceIssues,
      });
      await createIssue(newIssue);
      onClose();
      resetForm();
    } catch {
      setError('Failed to create issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = clearFields;

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={space ? `Create Issue in ${space.name}` : 'Create Issue'} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {spaces.length > 0 && (
          <SpacePicker spaces={spaces} value={pickedSpaceId} onChange={id => { setPickedSpaceId(id); setParentId(undefined); setError(''); }} />
        )}

        <TypePicker type={type} onChange={t => { setType(t); setParentId(undefined); }} />

        <ParentPicker type={type} space={space} candidates={parentCandidates(type, spaceIssues)} value={parentId} onChange={setParentId} />

        <Field label="Title" required>
          <input type="text" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" className={`${INPUT} py-2.5`} />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </Field>

        <TicketSuggestions
          title={title} description={description} type={type} spaceId={space?.id} existing={spaceIssues}
          labels={labels} priority={priority} parentId={parentId}
          onAddLabel={l => setLabels(prev => appendLabel(prev, l))}
          onPriority={setPriority}
          onEpic={setParentId}
        />

        <Field label="Description">
          <RichTextEditor value={description} onChange={setDescription} attachments={attachments} onAttachmentsChange={setAttachments} placeholder="Add a description..." minHeight={110} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value)} className={`${INPUT} py-2.5 bg-white`}>
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={`${INPUT} py-2.5 bg-white`}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Epics live outside sprints */}
        {type !== 'epic' && (
          <Field label="Sprint">
            <select value={sprintValue} onChange={e => setSprint(e.target.value)} className={`${INPUT} py-2.5 bg-white cursor-pointer`}>
              {openSprints.map(k => <option key={k} value={k}>{sprintName(k)}{k === currentSprintKey() ? ' (current)' : ''}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Due Date"><DatePicker value={dueDate} onChange={setDueDate} placeholder="No due date" aria-label="Due date" /></Field>
          <Field label="Labels">
            <input type="text" value={labels} onChange={e => setLabels(e.target.value)} placeholder="e.g. certification, aws" className={`${INPUT} py-2.5`} />
            <p className="text-3xs text-lira-muted mt-1">Comma-separated</p>
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-lira-border">
          <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading}>Create Issue</Button>
        </div>
      </form>
    </Modal>
  );
};
