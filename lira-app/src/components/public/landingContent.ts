/** The words and the sample board on the landing page. They are data so the page file only lays them out. */
export const FEATURES = [
  ['Tickets and boards', 'Plan a course, a certification or a project as tickets. Move them across a board, or work from a list.'],
  ['Sprints', 'Set a goal for two weeks, pull tickets in, and see what finished when the sprint ends.'],
  ['Roadmaps', 'Lay epics out over time, with Now, Next and Later when you want a simpler view.'],
  ['Dashboards', 'Charts for status, workload and progress, saved as weekly snapshots you can keep.'],
  ['Viva', 'Ask in plain words. Viva finds tickets and drafts changes, and nothing is saved until you approve it.'],
] as const;

export const DATA_POINTS = [
  ['Separate by organisation.', 'Each organisation has its own space. People in one cannot see or change another.'],
  ['Works without a connection.', 'Open it on a train. You can read your work offline, and it syncs when you are back online.'],
  ['Yours to take.', 'Download all of your data in one file whenever you want.'],
] as const;

export const SAMPLE_TABS = ['Summary', 'Board', 'List', 'Calendar', 'Sprints', 'Capacity'] as const;

export const SAMPLE_SIDEBAR = ['For you', 'Board', 'Sprints', 'Roadmaps', 'Dashboards'] as const;

export const SAMPLE_BOARD = [
  ['To do', [['AZ-104', 'Virtual networks lab', 'Study'], ['AZ-104', 'Read: Entra ID roles', 'Study'], ['OPS-31', 'Draft the Q1 review notes', 'Work']]],
  ['In progress', [['AZ-104', 'Storage accounts practice test', 'Study'], ['OPS-28', 'Sprint 12 goal check', 'Work']]],
  ['Done', [['AZ-104', 'Identity and access summary', 'Study'], ['OPS-24', 'Roadmap review with the team', 'Work']]],
] as const;
