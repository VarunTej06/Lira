import React from 'react';
import { Ban, Briefcase, Bug, FolderKanban, Gauge, Map, SlidersHorizontal, User, Users, Workflow } from 'lucide-react';
import type { Scenario } from '../../utils/dashboards/catalog';

const ICONS: Record<Scenario['icon'], React.ComponentType<{ className?: string }>> = {
  user: User, gauge: Gauge, users: Users, ban: Ban, workflow: Workflow, folder: FolderKanban, map: Map, bug: Bug, briefcase: Briefcase, sliders: SlidersHorizontal,
};

const TINT: Record<Scenario['icon'], string> = {
  user: 'bg-blue-100 text-blue-700', gauge: 'bg-emerald-100 text-emerald-700', users: 'bg-violet-100 text-violet-700', ban: 'bg-red-100 text-red-700',
  workflow: 'bg-sky-100 text-sky-700', folder: 'bg-amber-100 text-amber-700', map: 'bg-orange-100 text-orange-700', bug: 'bg-rose-100 text-rose-700',
  briefcase: 'bg-slate-200 text-slate-700', sliders: 'bg-gray-100 text-gray-700',
};

export const ScenarioIcon: React.FC<{ icon: Scenario['icon']; className?: string }> = ({ icon, className = 'w-10 h-10' }) => {
  const Icon = ICONS[icon];
  return <span className={`${className} rounded-xl flex items-center justify-center flex-shrink-0 ${TINT[icon]}`}><Icon className="w-1/2 h-1/2" /></span>;
};
