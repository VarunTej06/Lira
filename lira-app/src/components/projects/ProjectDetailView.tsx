import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { SprintsPage } from '../sprints/SprintsPage';
import { ProjectHeader } from './detail/ProjectHeader';
import { OverviewTab } from './detail/OverviewTab';
import { BoardTab } from './detail/BoardTab';
import { TicketsTab } from './detail/TicketsTab';
import { TechnicalTab } from './detail/TechnicalTab';
import { SettingsTab } from './detail/SettingsTab';
import { useProjectData } from './detail/useProjectData';
import { useProjectForms } from './detail/useProjectForms';
import type { DetailCtx, ProjectDetailViewProps, TabType } from './detail/types';

/** One project: header with tabs, and the chosen tab (overview, board, tickets, sprints, technical details, settings). */
export const ProjectDetailView: React.FC<ProjectDetailViewProps> = (props) => {
  const { project, issues, space, onUpdateProject, onDeleteProject, onIssueClick, onAddIssue } = props;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const data = useProjectData(project, issues);
  const forms = useProjectForms(project, onUpdateProject, onDeleteProject);
  const ctx: DetailCtx = { ...props, ...data, ...forms, activeTab, setActiveTab };
  const { projectIssues } = data;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-lira-bg font-sans">
      <ProjectHeader {...ctx} />

      {/* ── Main Tab Contents ── */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {activeTab === 'overview' && <OverviewTab {...ctx} />}
        {activeTab === 'board' && <BoardTab {...ctx} />}
        {activeTab === 'tickets' && <TicketsTab {...ctx} />}
        {activeTab === 'sprints' && (
          <SprintsPage
            key={project.id}
            spaces={space ? [space] : []}
            issues={projectIssues}
            lockedSpaceId={project.spaceId}
            onIssueClick={issue => onIssueClick?.(issue)}
            onAddIssue={onAddIssue}
          />
        )}
        {activeTab === 'technical' && <TechnicalTab {...ctx} />}
        {activeTab === 'settings' && <SettingsTab {...ctx} />}
      </div>

      {/* 2-second green toast */}
      {(forms.techSavedToast || forms.settingsSavedToast) && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </div>
  );
};
