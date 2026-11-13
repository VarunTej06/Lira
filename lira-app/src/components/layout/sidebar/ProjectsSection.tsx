import { projectLink } from '../../../utils/links';
import { confirmDialog } from '../../common/dialogStore';
import { Trash2, FolderKanban } from 'lucide-react';
import { RowMenuButton, ContextItem, SectionHeader, Collapsible } from './parts';
import type { SidebarState } from './useSidebarState';

/** The Projects list. */
export function ProjectsSection(s: SidebarState) {
  const { spaces, projects, activeProjectId, onSelectProject, onCreateProject, onDeleteProject, activeTab, projectsExpanded, setProjectsExpanded, rowMenu, setRowMenu } = s;
  return (
    <>
      {/* ── Projects Section ── */}
      <div className="py-2 border-b border-white/10">
        <SectionHeader
          title="Projects"
          count={projects.length}
          expanded={projectsExpanded}
          onToggle={() => setProjectsExpanded(!projectsExpanded)}
          onAdd={onCreateProject}
          addTitle="New project"
        />
        <Collapsible open={projectsExpanded}>
          <div className="mt-0.5 px-2 space-y-0.5">
            {projects.length === 0 ? (
              <div className="px-2 py-1.5 text-2xs text-white/30 italic">No projects yet</div>
            ) : (
              projects.map(p => {
                const space = spaces.find(sp => sp.id === p.spaceId);
                const active = activeProjectId === p.id && activeTab === 'Projects';
                return (
                  <div key={p.id} className="relative group" data-menu-root={`project:${p.id}`}>
                    <button
                      onClick={() => { setRowMenu(null); onSelectProject?.(p); }} {...projectLink(p.id)}
                      title={p.name}
                      data-active={active ? 'true' : undefined}
                      className={`w-full flex items-center gap-2.5 pl-2.5 pr-2.5 group-hover:pr-8 py-1.5 rounded-xl text-left text-xs transition-all duration-200 cursor-pointer ${
                        active ? 'text-white font-medium' : 'text-white/70 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-4xs font-bold text-white bg-white/15 flex-shrink-0"                      >
                        {p.key.slice(0, 2)}
                      </span>
                      <span className="truncate flex-1">{p.name}</span>
                    </button>
                    <RowMenuButton
                      open={rowMenu === `project:${p.id}`}
                      onToggle={() => setRowMenu(rowMenu === `project:${p.id}` ? null : `project:${p.id}`)}
                      label="Project actions"
                      menuKey={`project:${p.id}`}
                    >
                      <ContextItem icon={<FolderKanban className="w-3.5 h-3.5 text-violet-400" />} label="Open project" onClick={() => { setRowMenu(null); onSelectProject?.(p); }} />
                      <div className="border-t border-white/10 my-1" />
                      <ContextItem
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        label="Delete project"
                        danger
                        onClick={() => {
                          setRowMenu(null);
                          void confirmDialog({ title: 'Delete project', message: `Delete the project "${p.name}"? Its tickets stay in the ${space?.name ?? 'space'} space.`, confirmLabel: 'Delete project', tone: 'danger' }).then(ok => { if (ok) onDeleteProject?.(p); });
                        }}
                      />
                    </RowMenuButton>
                  </div>
                );
              })
            )}
          </div>
        </Collapsible>
      </div>
    </>
  );
}
