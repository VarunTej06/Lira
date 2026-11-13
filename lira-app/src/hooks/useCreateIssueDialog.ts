import { useCallback, useState } from 'react';

export interface CreateIssueOptions { sprint?: string; spaceId?: number; chooseSpace?: boolean }

/** Whether the Create dialog is open and what it starts with: the status, the sprint to preselect, the space, and whether the person must pick one. */
export function useCreateIssueDialog() {
  const [isOpen, setOpen] = useState(false);
  const [status, setStatus] = useState('todo');
  const [sprint, setSprint] = useState<string | undefined>(undefined);
  const [spaceId, setSpaceId] = useState<number | undefined>(undefined);
  const [chooseSpace, setChooseSpace] = useState(false);
  const open = useCallback((newStatus: string, opts?: CreateIssueOptions) => {
    setStatus(newStatus);
    setSprint(opts?.sprint);
    setSpaceId(opts?.spaceId);
    setChooseSpace(!!opts?.chooseSpace);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return { isOpen, status, sprint, spaceId, chooseSpace, open, close };
}
