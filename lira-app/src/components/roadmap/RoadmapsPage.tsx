import React from 'react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { RoadmapsHome } from './RoadmapsHome';
import { RoadmapDetail } from './RoadmapDetail';

interface Props {
  issues: Issue[];
  spaces: Space[];
  /** From the URL: /roadmaps shows the list, /roadmaps/<id> shows that roadmap with all its views. */
  roadmapId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}

export const RoadmapsPage: React.FC<Props> = ({ issues, spaces, roadmapId, onOpen, onBack }) =>
  roadmapId
    ? <RoadmapDetail roadmapId={roadmapId} issues={issues} spaces={spaces} onBack={onBack} />
    : <RoadmapsHome issues={issues} spaces={spaces} onOpen={onOpen} />;
