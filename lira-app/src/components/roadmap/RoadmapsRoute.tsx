import { useLocation, useNavigate } from 'react-router-dom';
import { RoadmapsPage } from './RoadmapsPage';
import { parsePath } from '../../routes';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

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
