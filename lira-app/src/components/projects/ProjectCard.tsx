import { ChevronRight } from 'lucide-react';
import { CountUp, GrowBar } from '../common/motion';
import { projectLink } from '../../utils/links';
import { projectIssues } from '../../utils/projectFilter';
import { StandupButton } from '../standup/StandupButton';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import type { Project } from '../../types/project';

/** One project in the Projects grid: name, key, description, space, lead and how much is done. */
export function ProjectCard({ project, spaces, issues, onOpen }: { project: Project; spaces: Space[]; issues: Issue[]; onOpen: (project: Project) => void }) {
  const space = spaces.find(s => s.id === project.spaceId) || spaces.find(s => s.key === project.key);
  const tickets = projectIssues(project, issues);
  const done = tickets.filter(i => i.status.toLowerCase() === 'done').length;
  const percent = tickets.length > 0 ? Math.round((done / tickets.length) * 100) : 0;
  const color = space?.color || '#0052CC';

  return (
    <div
      onClick={() => onOpen(project)} {...projectLink(project.id)}
      className="bg-white rounded-xl border border-lira-border hover:border-lira-blue/60 p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-xs flex-shrink-0" style={{ backgroundColor: color + '20', color }}>
              {space?.icon || '📁'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-lira-text group-hover:text-lira-blue transition-colors line-clamp-1">{project.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[11px] font-bold bg-blue-50 text-lira-blue px-1.5 py-0.2 rounded border border-blue-200">{project.key}</span>
                <span className="text-lira-muted text-[11px]">·</span>
                <span className="text-[11px] text-lira-muted truncate max-w-[130px]">{project.category || 'Software'}</span>
              </div>
            </div>
          </div>

          {/* The standup button must not open the card */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <StandupButton
              compact
              className="!px-2 !py-1"
              scope={{ type: 'project', id: `project:${project.id}`, name: project.name, spaceId: project.spaceId, projectKey: project.key }}
            />
            <div className="p-1 rounded-md text-gray-400 group-hover:text-lira-blue group-hover:bg-blue-50 transition-all flex-shrink-0"><ChevronRight className="w-4 h-4" /></div>
          </div>
        </div>

        <p className="text-xs text-lira-muted line-clamp-2 mt-2 leading-relaxed min-h-[36px]">{project.description || 'No project description provided.'}</p>

        <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-semibold text-lira-muted">Space:</span>
            {space ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border" style={{ backgroundColor: space.color + '15', borderColor: space.color + '40', color: space.color }}>
                <span>{space.icon}</span><span>{space.name}</span>
              </span>
            ) : <span className="text-xs text-gray-400">Unlinked Space</span>}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-lira-muted font-medium">
            <span className="w-5 h-5 rounded-full bg-lira-blue text-white text-[9px] font-bold flex items-center justify-center">{project.lead?.slice(0, 2).toUpperCase() || 'VY'}</span>
            <span className="truncate max-w-[80px]">{project.lead || 'Varun Tej'}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs mb-1.5 text-lira-muted">
          <span className="text-[11px] font-medium"><CountUp value={tickets.length} /> issue{tickets.length !== 1 ? 's' : ''} (<CountUp value={done} /> done)</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]"><CountUp value={percent} suffix="%" /></span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><GrowBar className="h-full bg-emerald-500 rounded-full" percent={percent} /></div>
      </div>
    </div>
  );
}
