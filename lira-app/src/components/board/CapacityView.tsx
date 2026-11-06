import React from 'react';
import { useCapacityState, type CapacityViewProps } from './capacity/useCapacityState';
import { CapacityBanner } from './capacity/CapacityBanner';
import { QuickFilterChips } from './capacity/QuickFilterChips';
import { GroupByStatus } from './capacity/GroupByStatus';
import { GroupByAssignee } from './capacity/GroupByAssignee';
import { GroupByPriority } from './capacity/GroupByPriority';
import { GroupByEpic } from './capacity/GroupByEpic';


/** Capacity and workload: who has how much, grouped by status, assignee, priority or epic. */
export const CapacityView: React.FC<CapacityViewProps> = (props) => {
  const s = useCapacityState(props);
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 space-y-6">
      <CapacityBanner {...s} />
      <QuickFilterChips {...s} />
      <GroupByStatus {...s} />
      <GroupByAssignee {...s} />
      <GroupByPriority {...s} />
      <GroupByEpic {...s} />
    </div>
  );
};
