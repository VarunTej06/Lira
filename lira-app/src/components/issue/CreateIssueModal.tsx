import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Space } from '../../types/space';
import { createIssue, getNextIssueKey, useIssuesBySpace } from '../../hooks/useIssues';
import type { Issue, Priority, IssueType } from '../../types/issue';
import { v4 as uuidv4 } from 'uuid';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  defaultStatus?: string;
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
  space,
  defaultStatus = 'todo',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('task');
  const [status, setStatus] = useState(defaultStatus);
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [labels, setLabels] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const spaceIssues = useIssuesBySpace(space?.id) || [];

  // Sync status when defaultStatus changes
  useEffect(() => {
    if (isOpen) {
      setStatus(defaultStatus);
    }
  }, [isOpen, defaultStatus]);

  const potentialParents = spaceIssues.filter(i => {
    if (type === 'subtask') return i.type === 'task' || i.type === 'bug';
    if (type === 'task') return i.type === 'epic';
    if (type === 'bug') return i.type === 'epic' || i.type === 'task';
    return false;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (!space?.id) return;

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
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Create Issue in ${space?.name || 'Space'}`} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
        {potentialParents.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">
              Parent Item {type === 'subtask' ? '(Task)' : '(Epic)'}
            </label>
            <select
              value={parentId || ''}
              onChange={e => setParentId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full text-sm border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue bg-white"
            >
              <option value="">None (Standalone issue)</option>
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
