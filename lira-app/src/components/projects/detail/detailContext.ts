import type { ProjectDetailViewProps, TabType } from './types';
import type { ProjectData } from './useProjectData';
import type { ProjectForms } from './useProjectForms';

/** Everything a tab of the project page can use: the props, the data hook, the forms hook and the current tab. */
export type DetailCtx = ProjectDetailViewProps & ProjectData & ProjectForms & {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
};
