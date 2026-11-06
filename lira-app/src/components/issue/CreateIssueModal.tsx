import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';
import { createIssue, getNextIssueKey, useIssuesBySpace } from '../../hooks/useIssues';
import type { Issue, Priority, IssueType } from '../../types/issue';
import { v4 as uuidv4 } from 'uuid';
import { currentSprintKey, shiftSprint, sprintName } from '../../utils/sprintUtils';

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

const ISSUE_TYPES: { value: IssueType; label: string; icon: string }[] = [
  { value: 'task', label: 'Task', icon: '✅' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'epic', label: 'Epic', icon: '⚡' },
  { value: 'subtask', label: 'Subtask', icon: '↳' },
];

const PRIORITIES: { value: Priority; label: string; icon: string }[] = [
  { value: 'highest', label: 'Highest', icon: '⏫' },
  { value: 'high', label: 'High', icon: '🔺' },
  { value: 'medium', label: 'Medium', icon: '▬' },
  { value: 'low', label: 'Low', icon: '🔻' },
  { value: 'lowest', label: 'Lowest', icon: '⏬' },
];

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('task');
  const [status, setStatus] = useState(defaultStatus);
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [labels, setLabels] = useState('');
  const [sprint, setSprint] = useState(currentSprintKey());
  const sprintChoices = Array.from(new Set([
    ...[-2, -1, 0, 1, 2, 3].map(d => shiftSprint(currentSprintKey(), d)),
    ...(defaultSprint ? [defaultSprint] : []),
  ])).sort();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const spaceIssues = useIssuesBySpace(space?.id) || [];

  // Sync status when defaultStatus changes
  useEffect(() => {
    if (isOpen) {
      setStatus(defaultStatus);
      setSprint(defaultSprint || currentSprintKey());
      setPickedSpaceId(chooseSpace ? undefined : spaceProp?.id);
      setParentId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultStatus, defaultSprint, chooseSpace, spaceProp?.id]);

  // Hierarchy: Epic (top level, no parent) → Task / Bug (optionally linked to an epic) → Subtask (must link to a task)
  const potentialParents = spaceIssues.filter(i => {
    if (type === 'subtask') return i.type === 'task' || i.type === 'bug';
    if (type === 'task' || type === 'bug') return i.type === 'epic';
    return false;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (!space?.id) { setError('Please choose a space for this ticket'); return; }
    if (type === 'subtask' && !parentId) { setError('Choose the task this subtask belongs to'); return; }

    setLoading(true);
    setError('');

    try {
      const key = await getNextIssueKey(space.key);
      const labelArray = labels.split(',').map(l => l.trim()).filter(Boolean);
      const now = new Date();

      const newIssue: Omit<Issue, 'id'> = {
        spaceId: space.id,
        key,
        parentId: parentId || undefined,
        epicId: parentId ? (spaceIssues.find(i => i.id === parentId)?.type === 'epic' ? parentId : spaceIssues.find(i => i.id === parentId)?.epicId) : undefined,
        epicLink: parentId ? spaceIssues.find(i => i.id === parentId)?.title : undefined,
        title: title.trim(),
        description: description.trim(),
        type,
        status,
        priority,
        assignee: 'VY',
        assigneeInitials: 'VY',
        reporter: 'VY',
        reporterInitials: 'VY',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        labels: labelArray,
        subtasks: [],
        comments: [],
        activity: [{
          id: uuidv4(),
          type: 'created',
          author: 'VY',
          authorInitials: 'VY',
          description: 'created this issue',
          createdAt: now,
        }],
        attachments: [],
        linkedIssues: [],
        sprint: type === 'epic' ? undefined : sprint,
        rank: Date.now(),
        createdAt: now,
        updatedAt: now,
        watchers: ['VY'],
      };

      await createIssue(newIssue);
      onClose();
      resetForm();
    } catch (err) {
      setError('Failed to create issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('task');
    setParentId(undefined);
    setPriority('medium');
    setDueDate('');
    setLabels('');
    setSprint(currentSprintKey());
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={space ? `Create Issue in ${space.name}` : 'Create Issue'} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {spaces.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Space <span className="text-red-500">*</span></label>
            <select
              value={pickedSpaceId ?? ''}
              onChange={e => { setPickedSpaceId(e.target.value ? Number(e.target.value) : undefined); setParentId(undefined); setError(''); }}
              autoFocus={!pickedSpaceId}
              className="w-full text-sm border border-jira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white cursor-pointer"
            >
              <option value="">Select a space…</option>
              {spaces.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name} ({s.key})</option>)}
            </select>
          </div>
        )}

        {/* Issue type */}
        <div>
          <label className="block text-xs font-semibold text-jira-muted mb-2 uppercase tracking-wide">Issue Type</label>
          <div className="flex gap-2">
            {ISSUE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setType(t.value);
                  setParentId(undefined);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all ${
                  type === t.value
                    ? 'border-jira-blue bg-jira-blue-light text-jira-blue font-semibold'
                    : 'border-jira-border text-jira-muted hover:border-gray-300 hover:text-jira-text'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Parent selector (if applicable for issue type) */}
        {type === 'epic' ? (
          <p className="text-xs text-jira-muted bg-gray-50 border border-jira-border rounded-xl px-3 py-2">
            ⚡ Epics are top-level — they don't link to a parent. Choose the space above.
          </p>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">
              {type === 'subtask' ? 'Parent task' : 'Epic'}{' '}
              {type === 'subtask' ? <span className="text-red-500">*</span> : <span className="normal-case font-normal">(optional)</span>}
            </label>
            <select
              value={parentId || ''}
              disabled={!space}
              onChange={e => setParentId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full text-sm border border-jira-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">
                {!space
                  ? 'Select a space first…'
                  : potentialParents.length === 0
                    ? `No ${type === 'subtask' ? 'tasks' : 'epics'} in ${space.name} yet`
                    : type === 'subtask' ? 'Select the parent task…' : 'No epic (standalone)'}
              </option>
              {potentialParents.map(p => (
                <option key={p.id} value={p.id}>
                  {p.key} — {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">
            Summary <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue transition-all"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={4}
            className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue resize-none transition-all"
          />
        </div>

        {/* Row: Status + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sprint (epics live outside sprints) */}
        {type !== 'epic' && (
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Sprint</label>
            <select
              value={sprint}
              onChange={e => setSprint(e.target.value)}
              className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white cursor-pointer"
            >
              {sprintChoices.map(k => (
                <option key={k} value={k}>{sprintName(k)}{k === currentSprintKey() ? ' (current)' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Row: Due Date + Labels */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">Labels</label>
            <input
              type="text"
              value={labels}
              onChange={e => setLabels(e.target.value)}
              placeholder="e.g. certification, aws"
              className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue transition-all"
            />
            <p className="text-[10px] text-jira-muted mt-1">Comma-separated</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-jira-border">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Create Issue
          </Button>
        </div>
      </form>
    </Modal>
  );
};
