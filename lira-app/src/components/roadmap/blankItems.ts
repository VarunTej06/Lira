import { fmtDay, newId, type Roadmap, type RoadmapItem, type RoadmapMilestone } from '../../utils/roadmapUtils';

export const blankItem = (roadmap: Roadmap, today = new Date()): RoadmapItem => ({
  id: newId('item'),
  title: '',
  lane: roadmap.lanes[0] || 'General',
  status: 'planned',
  start: fmtDay(today),
  end: fmtDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)),
  progress: 0,
  owner: 'VY',
  description: '',
  deps: [],
  children: [],
});

export const blankMilestone = (today = new Date()): RoadmapMilestone => ({
  id: newId('ms'), title: '', date: fmtDay(today), kind: 'milestone',
});
