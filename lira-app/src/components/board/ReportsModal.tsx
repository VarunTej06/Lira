import React, { useState, useMemo } from 'react';
import {
  BarChart3, PieChart, CheckCircle2, Clock,
  TrendingUp, Award, Layers, Flame
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | undefined;
  issues: Issue[];
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  isOpen,
  onClose,
  space,
  issues,
}) => {
  const [chartType, setChartType] = useState<'status' | 'priority'>('status');

  // Compute metrics
  const totalIssues = issues.length;
  const doneIssues = useMemo(() => issues.filter(i => i.status === 'done'), [issues]);
  const inProgressIssues = useMemo(() => issues.filter(i => i.status === 'inprogress'), [issues]);
  const todoIssues = useMemo(() => issues.filter(i => i.status === 'todo'), [issues]);
  const backlogIssues = useMemo(() => issues.filter(i => i.status === 'backlog'), [issues]);

  const doneCount = doneIssues.length;
  const inProgressCount = inProgressIssues.length;
  const todoCount = todoIssues.length;
  const backlogCount = backlogIssues.length;

  const completionRate = totalIssues > 0 ? Math.round((doneCount / totalIssues) * 100) : 0;
  const inFlightRate = totalIssues > 0 ? Math.round((inProgressCount / totalIssues) * 100) : 0;

  // Story points completion
  const totalPoints = useMemo(() => issues.reduce((acc, i) => acc + (i.storyPoints || 0), 0), [issues]);
  const donePoints = useMemo(() => doneIssues.reduce((acc, i) => acc + (i.storyPoints || 0), 0), [doneIssues]);
  const pointsCompletionRate = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  // High priority / urgent count
  const criticalCount = useMemo(() => issues.filter(i => i.priority === 'highest' || i.priority === 'high').length, [issues]);

  // Breakdown by priority
  const priorityCounts = useMemo(() => ({
    highest: issues.filter(i => i.priority === 'highest').length,
    high: issues.filter(i => i.priority === 'high').length,
    medium: issues.filter(i => i.priority === 'medium').length,
    low: issues.filter(i => i.priority === 'low').length,
    lowest: issues.filter(i => i.priority === 'lowest').length,
  }), [issues]);

  // Status donut segments computation for pure SVG
  // Radius = 40, Circumference = 2 * PI * 40 = 251.327
  const circumference = 2 * Math.PI * 40;
  const statusSegments = useMemo(() => {
    if (totalIssues === 0) return [];
    const segments = [
      { key: 'done', label: 'Done', count: doneCount, color: '#36B37E' },
      { key: 'inprogress', label: 'In Progress', count: inProgressCount, color: '#0052CC' },
      { key: 'todo', label: 'To Do', count: todoCount, color: '#4C9AFF' },
      { key: 'backlog', label: 'Backlog', count: backlogCount, color: '#6B778C' },
    ].filter(s => s.count > 0);

    let currentOffset = 0;
    return segments.map(seg => {
      const fraction = seg.count / totalIssues;
      const strokeDasharray = `${fraction * circumference} ${circumference}`;
      const strokeDashoffset = -currentOffset;
      currentOffset += fraction * circumference;
      return {
        ...seg,
        fraction,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [totalIssues, doneCount, inProgressCount, todoCount, backlogCount, circumference]);

  // Priority donut segments
  const prioritySegments = useMemo(() => {
    if (totalIssues === 0) return [];
    const segments = [
      { key: 'highest', label: 'Highest', count: priorityCounts.highest, color: '#FF0000' },
      { key: 'high', label: 'High', count: priorityCounts.high, color: '#FF5630' },
      { key: 'medium', label: 'Medium', count: priorityCounts.medium, color: '#FF8B00' },
      { key: 'low', label: 'Low', count: priorityCounts.low, color: '#36B37E' },
      { key: 'lowest', label: 'Lowest', count: priorityCounts.lowest, color: '#00B8D9' },
    ].filter(s => s.count > 0);

    let currentOffset = 0;
    return segments.map(seg => {
      const fraction = seg.count / totalIssues;
      const strokeDasharray = `${fraction * circumference} ${circumference}`;
      const strokeDashoffset = -currentOffset;
      currentOffset += fraction * circumference;
      return {
        ...seg,
        fraction,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [totalIssues, priorityCounts, circumference]);

  const activeSegments = chartType === 'status' ? statusSegments : prioritySegments;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reports & Analytics · ${space?.name || 'Workspace'}`}
      size="xl"
    >
      <div className="flex flex-col h-[600px] text-lira-text overflow-hidden">
        {/* KPI Cards Row */}
        <div className="p-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/60 border-b border-lira-border flex-shrink-0">
          {/* 1. Total Issues */}
          <div className="bg-white p-3.5 rounded-xl border border-lira-border shadow-xs">
            <div className="flex items-center justify-between text-lira-muted mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Work</span>
              <Layers className="w-4 h-4 text-lira-blue" />
            </div>
            <div className="text-2xl font-bold text-lira-text">{totalIssues}</div>
            <div className="text-[11px] text-lira-muted mt-0.5">items in space</div>
          </div>

          {/* 2. Done Count */}
          <div className="bg-white p-3.5 rounded-xl border border-lira-border shadow-xs">
            <div className="flex items-center justify-between text-lira-muted mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Done</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">{doneCount}</div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              {completionRate}% completed
            </div>
          </div>

          {/* 3. In Progress Count */}
          <div className="bg-white p-3.5 rounded-xl border border-lira-border shadow-xs">
            <div className="flex items-center justify-between text-lira-muted mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">In Progress</span>
              <Clock className="w-4 h-4 text-lira-blue" />
            </div>
            <div className="text-2xl font-bold text-lira-blue">{inProgressCount}</div>
            <div className="text-[11px] text-blue-700 font-semibold mt-0.5">
              {inFlightRate}% active in flight
            </div>
          </div>

          {/* 4. Velocity / Points */}
          <div className="bg-white p-3.5 rounded-xl border border-lira-border shadow-xs">
            <div className="flex items-center justify-between text-lira-muted mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Story Points</span>
              <Award className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {donePoints} <span className="text-sm font-normal text-lira-muted">/ {totalPoints}</span>
            </div>
            <div className="text-[11px] text-purple-700 font-semibold mt-0.5">
              {pointsCompletionRate}% points delivered
            </div>
          </div>
        </div>

        {/* Chart View Switcher */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-lira-border bg-white flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setChartType('status')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                chartType === 'status'
                  ? 'bg-lira-blue text-white shadow-xs'
                  : 'text-lira-muted hover:text-lira-text hover:bg-gray-100'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              Status Breakdown
            </button>
            <button
              onClick={() => setChartType('priority')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                chartType === 'priority'
                  ? 'bg-lira-blue text-white shadow-xs'
                  : 'text-lira-muted hover:text-lira-text hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Priority Distribution
            </button>
          </div>

          <div className="text-xs text-lira-muted flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="text-red-600 font-semibold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]">
                <Flame className="w-3 h-3 text-red-500" /> {criticalCount} high priority
              </span>
            )}
          </div>
        </div>

        {/* Charts & Visualizations Area */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Column: Pure SVG Donut Chart */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-gray-50/50 rounded-2xl border border-lira-border">
            <h4 className="text-xs font-bold text-lira-muted uppercase tracking-wider mb-4">
              {chartType === 'status' ? 'Status Ratio Donut' : 'Priority Distribution'}
            </h4>

            {totalIssues === 0 ? (
              <div className="py-12 text-center text-lira-muted text-xs">No issues on board</div>
            ) : (
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#E2E8F0"
                    strokeWidth="12"
                  />
                  {/* Slices */}
                  {activeSegments.map(seg => (
                    <circle
                      key={seg.key}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>

                {/* Center text in donut hole */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-lira-text leading-none">
                    {chartType === 'status' ? `${completionRate}%` : totalIssues}
                  </span>
                  <span className="text-[10px] text-lira-muted uppercase font-semibold mt-1">
                    {chartType === 'status' ? 'Complete' : 'Total Items'}
                  </span>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-4 text-[11px]">
              {activeSegments.map(seg => (
                <div key={seg.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-lira-text font-medium">{seg.label}:</span>
                  <span className="font-bold text-lira-text">{seg.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Tailwind Horizontal Bar Charts */}
          <div className="md:col-span-7 flex flex-col justify-center space-y-4">
            <h4 className="text-xs font-bold text-lira-muted uppercase tracking-wider mb-1">
              Detailed Breakdown
            </h4>

            {chartType === 'status' ? (
              <div className="space-y-3.5">
                {[
                  { label: 'Done', count: doneCount, color: 'bg-emerald-500', barBg: 'bg-emerald-100', textCol: 'text-emerald-700' },
                  { label: 'In Progress', count: inProgressCount, color: 'bg-blue-600', barBg: 'bg-blue-100', textCol: 'text-blue-700' },
                  { label: 'To Do', count: todoCount, color: 'bg-sky-500', barBg: 'bg-sky-100', textCol: 'text-sky-700' },
                  { label: 'Backlog', count: backlogCount, color: 'bg-gray-400', barBg: 'bg-gray-200', textCol: 'text-gray-600' },
                ].map(item => {
                  const pct = totalIssues > 0 ? Math.round((item.count / totalIssues) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-lira-text">{item.label}</span>
                        <span className="text-lira-muted">
                          <strong className={item.textCol}>{item.count}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className={`w-full h-3 rounded-full ${item.barBg} overflow-hidden`}>
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3.5">
                {[
                  { label: 'Highest', count: priorityCounts.highest, color: 'bg-red-600', barBg: 'bg-red-100' },
                  { label: 'High', count: priorityCounts.high, color: 'bg-amber-600', barBg: 'bg-amber-100' },
                  { label: 'Medium', count: priorityCounts.medium, color: 'bg-yellow-500', barBg: 'bg-yellow-100' },
                  { label: 'Low', count: priorityCounts.low, color: 'bg-emerald-500', barBg: 'bg-emerald-100' },
                  { label: 'Lowest', count: priorityCounts.lowest, color: 'bg-cyan-500', barBg: 'bg-cyan-100' },
                ].map(item => {
                  const pct = totalIssues > 0 ? Math.round((item.count / totalIssues) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-lira-text">{item.label}</span>
                        <span className="text-lira-muted">
                          <strong className="text-lira-text">{item.count}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className={`w-full h-3 rounded-full ${item.barBg} overflow-hidden`}>
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Health summary callout */}
            <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl text-xs text-blue-900 mt-2 flex items-start gap-2.5">
              <TrendingUp className="w-4 h-4 text-lira-blue flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Project Progress: </span>
                {completionRate >= 75
                  ? 'Excellent velocity! Over 75% of scheduled work items have been marked as done.'
                  : completionRate >= 40
                  ? 'Steady progression. Active tasks are transitioning smoothly through development.'
                  : 'Early sprint phase. Focus on clearing In Progress bottlenecks to increase velocity.'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-lira-border bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-lira-muted text-[11px]">
            Aggregated from {totalIssues} issues in {space?.name || 'current space'}
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
