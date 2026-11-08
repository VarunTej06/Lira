import React from 'react';
import { useLocation } from 'react-router-dom';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { parsePath } from '../../routes';
import { DashboardsHome } from './DashboardsHome';
import { DashboardView } from './DashboardView';
import { DashboardWizard } from './DashboardWizard';

/** /dashboards (the list), /dashboards/new (the wizard) and /dashboards/<id> (one dashboard). */
export const DashboardsPage: React.FC<{ issues: Issue[]; spaces: Space[]; onOpenIssue: (issue: Issue) => void }> = ({ issues, spaces, onOpenIssue }) => {
  const { pathname } = useLocation();
  const r = parsePath(pathname);
  const id = r.kind === 'dashboards' ? r.dashboardId : undefined;
  if (!id) return <DashboardsHome issues={issues} spaces={spaces} />;
  if (id === 'new') return <DashboardWizard issues={issues} spaces={spaces} />;
  return <DashboardView key={id} dashboardId={id} issues={issues} spaces={spaces} onOpenIssue={onOpenIssue} />;
};
