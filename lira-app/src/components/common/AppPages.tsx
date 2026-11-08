import { useLocation, useNavigate } from 'react-router-dom';
import { RoadmapsPage } from '../roadmap/RoadmapsPage';
import { parsePath } from '../../routes';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

/** Shown when there are no spaces at all. */
export function NoSpaces({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <img src="/lira-full-logo.png" alt="Lira Workspace" className="h-20 mx-auto object-contain drop-shadow-sm" />
        <p className="text-lira-muted text-sm">Select a space or create one to get started.</p>
        <button onClick={onCreate} className="px-5 py-2.5 bg-lira-blue text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
          Create your first space
        </button>
      </div>
    </div>
  );
}

/** /roadmaps and /roadmaps/<id>: the list, or one roadmap. */
export function RoadmapsRoute({ issues, spaces }: { issues: Issue[]; spaces: Space[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const r = parsePath(pathname);
  return (
    <RoadmapsPage
      issues={issues}
      spaces={spaces}
      roadmapId={r.kind === 'roadmaps' ? r.roadmapId : undefined}
      onOpen={id => navigate(`/roadmaps/${encodeURIComponent(id)}`)}
      onBack={() => navigate('/roadmaps')}
    />
  );
}
