import React, { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { Subtask } from '../../types/issue';
import { v4 as uuidv4 } from 'uuid';
import { PALETTE } from '../../theme/palette';

interface IssueSubtasksProps {
  subtasks: Subtask[];
  onUpdate: (subtasks: Subtask[]) => void;
}

export const IssueSubtasks: React.FC<IssueSubtasksProps> = ({ subtasks, onUpdate }) => {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const completed = subtasks.filter(s => s.completed).length;
  const total = subtasks.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleToggle = (id: string) => {
    onUpdate(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleDelete = (id: string) => {
    onUpdate(subtasks.filter(s => s.id !== id));
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onUpdate([...subtasks, {
      id: uuidv4(),
      title: newTitle.trim(),
      completed: false,
      createdAt: new Date(),
    }]);
    setNewTitle('');
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-lira-text">
          Child Issues
          {total > 0 && <span className="ml-2 text-lira-muted font-normal text-xs">({completed}/{total})</span>}
        </h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-lira-blue hover:text-blue-800 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add child issue
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: progress === 100 ? PALETTE.success : PALETTE.brand,
              }}
            />
          </div>
          <p className="text-3xs text-lira-muted">{Math.round(progress)}% complete</p>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map(subtask => (
          <div
            key={subtask.id}
            className="group flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <button
              onClick={() => handleToggle(subtask.id)}
              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                subtask.completed
                  ? 'border-lira-green bg-lira-green text-white'
                  : 'border-lira-border hover:border-lira-blue'
              }`}
            >
              {subtask.completed && <Check className="w-2.5 h-2.5" />}
            </button>
            <span className={`flex-1 text-sm transition-all ${
              subtask.completed ? 'line-through text-lira-muted' : 'text-lira-text'
            }`}>
              {subtask.title}
            </span>
            <button
              onClick={() => handleDelete(subtask.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-lira-muted hover:text-red-500 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new subtask */}
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
            }}
            placeholder="What needs to be done?"
            className="flex-1 text-sm border border-lira-border rounded px-3 py-1.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 text-xs bg-lira-blue text-white rounded hover:bg-blue-700 font-medium"
          >
            Add
          </button>
          <button
            onClick={() => { setAdding(false); setNewTitle(''); }}
            className="px-2 py-1.5 text-xs text-lira-muted hover:text-lira-text"
          >
            Cancel
          </button>
        </div>
      ) : (
        total === 0 && (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-xs text-lira-muted hover:text-lira-text py-2 border border-dashed border-lira-border rounded-lg hover:border-lira-blue transition-colors"
          >
            + Add first subtask
          </button>
        )
      )}
    </div>
  );
};
