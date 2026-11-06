import {  FileText, FileJson } from 'lucide-react';
import type { FiltersState } from './useFiltersState';

/** Title, result count and export buttons. */
export function FiltersHeader(s: FiltersState) {
  const {  onBackToBoard, exportToast, activeFiltersCount, handleExportCSV, handleExportJSON } = s;
  return (
    <>
      {/* ── Top Header ── */}
      <div className="bg-white border-b border-jira-border px-6 py-3.5 flex-shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-jira-text">Filters &amp; Search Explorer</h1>
              {activeFiltersCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full">
                  {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
                </span>
              )}
            </div>
            <p className="text-xs text-jira-muted mt-0.5">
              Query, facet, and export work items across spaces, assignees, workflows, and priority tiers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onBackToBoard && (
              <button
                onClick={onBackToBoard}
                className="px-3 py-1.5 text-xs font-semibold text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                ← Back to Board
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              title="Download results as CSV"
            >
              <FileText className="w-3.5 h-3.5 text-green-600" />
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-jira-text border border-jira-border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              title="Download results as JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-600" />
              Export JSON
            </button>
          </div>
        </div>

        {exportToast && (
          <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-md inline-block font-medium">
            ✓ {exportToast}
          </div>
        )}
      </div>
    </>
  );
}
