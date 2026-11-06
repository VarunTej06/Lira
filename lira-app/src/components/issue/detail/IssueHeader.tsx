import { X, Maximize2, Share2, MoreHorizontal, Eye, ChevronDown, ChevronRight, Trash2, ExternalLink, Link } from 'lucide-react';
import type {  IssueType } from '../../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { ISSUE_TYPE_OPTIONS, safeArr } from './useIssueDetail';
import type { IssueDetailState } from './useIssueDetail';

/** Breadcrumb, type selector and the action buttons. */
export function IssueHeader(s: IssueDetailState) {
  const {  onClose, onNavigateToIssue, local, showTypeMenu, setShowTypeMenu, showMoreMenu, setShowMoreMenu, setShowDeleteConfirm, typeMenuRef, moreMenuRef, resolvedParent, handleTypeChange, typeConfig } = s;
  return (
    <>
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-jira-border flex-shrink-0 bg-white">
          {/* Left: breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            {resolvedParent && (
              <>
                <button
                  onClick={() => onNavigateToIssue?.(resolvedParent)}
                  className="flex items-center gap-1 text-xs text-jira-blue hover:underline font-medium"
                >
                  <span style={{ color: ISSUE_TYPE_CONFIG[resolvedParent.type]?.color }}>
                    {ISSUE_TYPE_CONFIG[resolvedParent.type]?.symbol}
                  </span>
                  {resolvedParent.key}
                </button>
                <ChevronRight className="w-3 h-3 text-jira-muted flex-shrink-0" />
              </>
            )}
            {/* Type selector dropdown */}
            <div className="relative" ref={typeMenuRef}>
              <button
                type="button"
                onClick={() => setShowTypeMenu(v => !v)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold hover:opacity-85 transition-opacity cursor-pointer group"
                style={{ color: typeConfig.color, backgroundColor: typeConfig.bg }}
                title="Click to convert/change issue type"
              >
                <span>{typeConfig.symbol}</span>
                <span>{typeConfig.label}</span>
                <span className="font-mono">{local.key}</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
              {showTypeMenu && (
                <div className="absolute left-0 top-8 z-50 bg-white border border-jira-border rounded-lg shadow-dropdown py-1 min-w-[160px] animate-scale-in">
                  <div className="px-3 py-1 text-[10px] font-semibold text-jira-muted uppercase tracking-wider border-b border-gray-100">
                    Change Issue Type
                  </div>
                  {ISSUE_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setShowTypeMenu(false);
                        handleTypeChange(opt.value as IssueType);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                        opt.value === local.type ? 'bg-blue-50/70 font-semibold text-jira-blue' : 'text-jira-text'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                      {opt.value === local.type && <span className="ml-auto text-jira-blue text-[11px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: utility actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-jira-muted bg-gray-100 rounded px-2 py-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{safeArr(local.watchers).length}</span>
            </div>
            <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Share">
              <Share2 className="w-4 h-4" />
            </button>

            {/* More menu */}
            <div ref={moreMenuRef} className="relative">
              <button
                onClick={() => setShowMoreMenu(m => !m)}
                className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-8 z-50 bg-white border border-jira-border rounded-lg shadow-dropdown py-1 min-w-[180px] animate-scale-in">
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-jira-text">
                    <Link className="w-3.5 h-3.5 text-jira-muted" /> Copy link
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-jira-text">
                    <ExternalLink className="w-3.5 h-3.5 text-jira-muted" /> Open in full page
                  </button>
                  <div className="border-t border-jira-border my-1" />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete issue
                  </button>
                </div>
              )}
            </div>

            <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Fullscreen">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
    </>
  );
}
