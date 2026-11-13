import { PALETTE } from '../../theme/palette';
/** Roadmap types, status colours and lane colours. */
export type RoadmapStatus = 'planned' | 'inprogress' | 'done' | 'atrisk' | 'blocked';

export type Horizon = 'done' | 'now' | 'next' | 'later';

export type Zoom = 'weeks' | 'months' | 'quarters';

export type MilestoneKind = 'milestone' | 'release';

export interface RoadmapChild { id: string; title: string; done: boolean }

export interface RoadmapItem {
  id: string;
  title: string;
  lane: string;            // swimlane / theme name
  status: RoadmapStatus;
  start: string;           // YYYY-MM-DD
  end: string;             // YYYY-MM-DD (inclusive)
  progress: number;        // 0-100, used when there are no children / linked tickets
  owner?: string;
  description?: string;
  deps: string[];          // ids of items that must finish first
  children: RoadmapChild[];
  /** Every roadmap item is backed by a Lira epic (e.g. "LIRA-12"), created in the Backlog when the item is added. */
  epicKey?: string;
  /** The single task under that epic that carries this item's checklist (each checklist entry is one of its subtasks). */
  taskKey?: string;
}

export interface RoadmapMilestone { id: string; title: string; date: string; kind: MilestoneKind }

export interface Roadmap {
  id: string;
  name: string;
  description?: string;
  projectKey?: string;
  /** Key of the space where this roadmap's epics are created, e.g. "LIRA". */
  spaceKey?: string;
  starred?: boolean;
  archived?: boolean;
  updatedAt?: string;
  /** Which schedule of the built-in Lira roadmap this copy has (see migrateLiraSchedule). */
  scheduleVersion?: number;
  /** Set when dates changed and the roadmap's epics and tasks still need to follow. */
  pendingTicketSync?: boolean;
  lanes: string[];
  items: RoadmapItem[];
  milestones: RoadmapMilestone[];
  createdAt: string;
}

export const STATUS_META: Record<RoadmapStatus, { label: string; color: string }> = {
  planned:    { label: 'Planned',     color: '#5A6882' },
  inprogress: { label: 'In progress', color: PALETTE.link },
  done:       { label: 'Done',        color: '#187A4E' },
  atrisk:     { label: 'At risk',     color: PALETTE.warning },
  blocked:    { label: 'Blocked',     color: PALETTE.criticalDeep },
};

const LANE_COLORS = [PALETTE.link, PALETTE.purple, PALETTE.successSoft, PALETTE.warning, PALETTE.info, PALETTE.criticalDeep, '#8F7EE7', '#B38600'];

export const laneColor = (rm: Roadmap, lane: string) => LANE_COLORS[Math.max(0, rm.lanes.indexOf(lane)) % LANE_COLORS.length];
