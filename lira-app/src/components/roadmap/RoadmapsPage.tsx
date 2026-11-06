import React, { useEffect, useState } from 'react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { RoadmapsHome } from './RoadmapsHome';
import { RoadmapDetail } from './RoadmapDetail';

export const ROADMAPS_HOME_EVENT = 'lira-roadmaps-home';

interface Props { issues: Issue[]; spaces: Space[] }

/** Roadmaps: the list of roadmaps first, then the chosen roadmap with all its views. */
export const RoadmapsPage: React.FC<Props> = ({ issues, spaces }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  // Clicking "Roadmaps" in the sidebar while inside a roadmap goes back to the list
  useEffect(() => {
    const home = () => setOpenId(null);
    window.addEventListener(ROADMAPS_HOME_EVENT, home);
    return () => window.removeEventListener(ROADMAPS_HOME_EVENT, home);
  }, []);

  return openId
    ? <RoadmapDetail roadmapId={openId} issues={issues} spaces={spaces} onBack={() => setOpenId(null)} />
    : <RoadmapsHome issues={issues} spaces={spaces} onOpen={setOpenId} />;
};
