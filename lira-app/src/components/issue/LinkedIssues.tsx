import React from 'react';
import { X } from 'lucide-react';
import type { Issue, LinkedIssue } from '../../types/issue';
import { issueLink } from '../../utils/links';
import { statusLabel } from '../../utils/status';
import { LINK_LABEL } from '../../utils/ticketLinks';
import { TypeIcon } from '../common/Icons';

interface LinkedIssuesProps {
  links: LinkedIssue[];
  /** Every ticket, to look up the one each link points to. */
  tickets: Issue[];
  onOpen: (issue: Issue) => void;
  onRemove: (link: LinkedIssue) => void;
}

/** The tickets linked to this one, each with how it is linked ("blocks", "relates to" ...). A link to a deleted ticket is not shown. */
export const LinkedIssues: React.FC<LinkedIssuesProps> = ({ links, tickets, onOpen, onRemove }) => {
  const rows = links.map(link => ({ link, issue: tickets.find(t => t.id === link.issueId) })).filter((r): r is { link: LinkedIssue; issue: Issue } => !!r.issue);
  if (rows.length === 0) return <p className="text-xs text-lira-muted py-1" data-testid="no-links">No tickets linked.</p>;
  return (
    <ul className="border border-lira-border rounded-lg overflow-hidden" data-testid="linked-issues">
      {rows.map(({ link, issue }) => (
        <li key={`${link.linkType}-${link.issueId}`} className="flex items-center gap-2 px-3 py-2 border-b border-lira-border last:border-0 hover:bg-gray-50 transition-colors group">
          <span className="text-2xs font-semibold text-lira-muted w-24 flex-shrink-0">{LINK_LABEL[link.linkType]}</span>
          <button onClick={() => onOpen(issue)} {...issueLink(issue)} className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer" title={`Open ${issue.key}`}>
            <TypeIcon type={issue.type} className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-mono text-lira-muted flex-shrink-0">{issue.key}</span>
            <span className="text-sm text-lira-text group-hover:text-lira-blue transition-colors truncate">{issue.title}</span>
          </button>
          <span className="text-3xs text-lira-muted flex-shrink-0">{statusLabel(issue.status)}</span>
          <button type="button" onClick={() => onRemove(link)} aria-label={`Remove link to ${issue.key}`} className="p-0.5 rounded text-lira-muted hover:text-red-600 hover:bg-gray-100 cursor-pointer flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
};
