import { useState } from 'react';
import type { Attachment, IssueType, Priority } from '../../types/issue';
import { currentSprintKey } from '../../utils/sprintUtils';

/** The fields of the Create dialog and the error line. `clearFields` empties what the person typed but keeps the status. */
export function useCreateIssueFields(defaultStatus: string) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [type, setType] = useState<IssueType>('task');
  const [status, setStatus] = useState(defaultStatus);
  const [parentId, setParentId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [labels, setLabels] = useState('');
  const [sprint, setSprint] = useState(currentSprintKey());
  const [error, setError] = useState('');

  const clearFields = () => {
    setTitle('');
    setDescription('');
    setAttachments([]);
    setType('task');
    setParentId(undefined);
    setPriority('medium');
    setDueDate('');
    setLabels('');
    setSprint(currentSprintKey());
    setError('');
  };

  return {
    title, setTitle, description, setDescription, attachments, setAttachments, type, setType, status, setStatus, parentId, setParentId,
    priority, setPriority, dueDate, setDueDate, labels, setLabels, sprint, setSprint, error, setError, clearFields,
  };
}
