import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { withIssue } from '../routes';
import type { Issue } from '../types/issue';
import { useResetWhen } from './useResetWhen';

/**
 * The ticket popup. It lives in the URL (?issue=LIRA-12), so it can be shared and bookmarked, Back closes it, and a page
 * loaded with the parameter opens it. Drilling in from an epic to a task to a subtask keeps a stack, so "back to parent" works.
 */
export function useIssuePopup(allIssues: Issue[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const issueParam = searchParams.get('issue');
  const [stack, setStack] = useState<Issue[]>([]);
  const selectedIssue = stack.length > 0 ? stack[stack.length - 1] : null;
  const parentIssue = stack.length > 1 ? stack[stack.length - 2] : null;

  const setIssueParam = useCallback((key: string | null, replace = false) => {
    setSearchParams(prev => new URLSearchParams(withIssue(prev.toString(), key)), { replace });
  }, [setSearchParams]);

  // URL -> popup (page load, Back / Forward)
  useResetWhen([issueParam, allIssues], () => {
    if (!issueParam) { if (stack.length) setStack([]); return; }
    if (selectedIssue?.key === issueParam) return;
    const inStack = stack.findIndex(i => i.key === issueParam);
    if (inStack >= 0) { setStack(s => s.slice(0, inStack + 1)); return; }
    const found = allIssues.find(i => i.key === issueParam);
    if (found) setStack([found]);
  });

  const openIssue = useCallback((issue: Issue) => { setStack([issue]); setIssueParam(issue.key); }, [setIssueParam]);
  const navigateToIssue = useCallback((issue: Issue) => {
    setStack(prev => {
      const existingIdx = prev.findIndex(i => i.id === issue.id);
      return existingIdx >= 0 ? prev.slice(0, existingIdx + 1) : [...prev, issue];
    });
    setIssueParam(issue.key);
  }, [setIssueParam]);
  const closeModal = useCallback(() => { setStack([]); setIssueParam(null, true); }, [setIssueParam]);

  // Other components (the standup popup, roadmaps) ask the app to open a ticket via a window event
  useEffect(() => {
    const onOpen = (e: Event) => { const issue = (e as CustomEvent<Issue>).detail; if (issue) openIssue(issue); };
    window.addEventListener('lira-open-issue', onOpen);
    return () => window.removeEventListener('lira-open-issue', onOpen);
  }, [openIssue]);

  return { selectedIssue, parentIssue, openIssue, navigateToIssue, closeModal };
}
